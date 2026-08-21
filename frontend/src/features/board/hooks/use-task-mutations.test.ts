import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { recurrenceKeys } from "@/features/recurrence/api/recurrence-queries";
import type { BoardQueryParams, TaskDetail } from "../types";
import { useTaskMutations } from "./use-task-mutations";

const create = vi.fn();
const update = vi.fn();
const remove = vi.fn();
const stopRecurrence = vi.fn();

vi.mock("../api/task-mutations", () => ({
  taskMutations: {
    create: (...args: unknown[]) => create(...args),
    update: (...args: unknown[]) => update(...args),
    remove: (...args: unknown[]) => remove(...args),
    stopRecurrence: (...args: unknown[]) => stopRecurrence(...args),
  },
}));

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    uploadAttachment: vi.fn(),
    deleteAttachment: vi.fn(),
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

describe("useTaskMutations recurrence invalidation", () => {
  beforeEach(() => {
    create.mockReset();
    update.mockReset();
    remove.mockReset();
    stopRecurrence.mockReset();
  });

  it("invalidates recurrence queries after create, edit, delete, and stop", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    create.mockResolvedValue(task);
    update.mockResolvedValue(task);
    remove.mockResolvedValue(undefined);
    stopRecurrence.mockResolvedValue({ id: "series-1", status: "stopped" });
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
    await act(async () => {
      await result.current.stopRecurrence.mutateAsync("series-1");
    });

    const recurrenceCalls = invalidate.mock.calls.filter(
      ([options]) =>
        options &&
        typeof options === "object" &&
        "queryKey" in options &&
        options.queryKey === recurrenceKeys.all,
    );
    expect(recurrenceCalls).toHaveLength(4);
  });
});
