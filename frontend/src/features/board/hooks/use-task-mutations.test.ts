import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";

import { todayKeys } from "@/features/today/api/today-queries";
import type { BoardQueryParams, TaskDetail } from "../types";
import { useTaskMutations } from "./use-task-mutations";

const create = jest.fn();
const update = jest.fn();
const remove = jest.fn();

jest.mock("../api/task-mutations", () => ({
  taskMutations: {
    create: (...args: unknown[]) => create(...args),
    update: (...args: unknown[]) => update(...args),
    remove: (...args: unknown[]) => remove(...args),
  },
}));

jest.mock("@/lib/api-client", () => ({
  apiClient: {
    uploadAttachment: jest.fn(),
    deleteAttachment: jest.fn(),
  },
}));

const params: BoardQueryParams = {
  boardId: "board-work",
  startDate: "2026-08-21",
  endDate: "2026-08-21",
  dateField: "due_date",
  unbounded: false,
};

const task = { id: "task-1", board_id: "board-work", title: "Weekly standup" } as unknown as TaskDetail;

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children);
  };
}

describe("useTaskMutations invalidation", () => {
  beforeEach(() => {
    create.mockReset();
    update.mockReset();
    remove.mockReset();
  });

  it("refreshes related views after create, edit, and delete", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = jest.spyOn(client, "invalidateQueries");
    create.mockResolvedValue(task);
    update.mockResolvedValue(task);
    remove.mockResolvedValue(undefined);
    const { result } = renderHook(() => useTaskMutations(params), { wrapper: wrapper(client) });

    await act(async () => {
      await result.current.create.mutateAsync({
        column_id: "col-todo",
        category_id: "cat-1",
        title: "Weekly standup",
        start_date: "2026-08-21",
        due_date: "2026-08-21",
      });
    });
    await act(async () => {
      await result.current.update.mutateAsync({
        taskId: "task-1",
        payload: { title: "Renamed" },
      });
    });
    await act(async () => {
      await result.current.remove.mutateAsync({ taskId: "task-1" });
    });

    expect(remove).toHaveBeenCalledWith("task-1");
    const todayCalls = invalidate.mock.calls.filter(
      ([options]) =>
        options &&
        typeof options === "object" &&
        "queryKey" in options &&
        options.queryKey === todayKeys.all,
    );
    expect(todayCalls).toHaveLength(3);
  });
});
