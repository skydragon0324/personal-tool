import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";

import type { ColumnDetail, TaskCreate } from "@/features/board/types";
import { LAST_BOARD_STORAGE_KEY } from "@/features/board/utils/last-board";

import { QuickCreateTask, startingColumn } from "./quick-create-task";

const mockCreateTask = jest.fn();
const mockListBoards = jest.fn();
const mockNotifySuccess = jest.fn();
const dialogProps: { current: Record<string, unknown> | null } = { current: null };

jest.mock("@/lib/api-client", () => ({
  ApiError: class ApiError extends Error {},
  apiClient: {
    listBoards: (...args: unknown[]) => mockListBoards(...args),
    listColumns: (boardId: string) =>
      Promise.resolve([
        { id: `${boardId}-done`, name: "Done", is_done: true, position: 0, archived_at: null },
        { id: `${boardId}-todo`, name: "Todo", is_done: false, position: 1, archived_at: null },
      ]),
    createTask: (...args: unknown[]) => mockCreateTask(...args),
    updateTask: jest.fn(),
    uploadAttachment: jest.fn(),
  },
}));

jest.mock("@/lib/notify", () => ({
  notifyApiError: jest.fn(),
  notifySuccess: (...args: unknown[]) => mockNotifySuccess(...args),
}));

// The regular task dialog (and its form) is tested elsewhere; here we check what it is given.
jest.mock("./task-dialog", () => ({
  TaskDialog: (props: Record<string, unknown>) => {
    dialogProps.current = props;
    return createElement("div", { "data-testid": "task-dialog" }, `${props.title} | ${props.boardId} | ${props.columnId} | ${props.dueDate}`);
  },
}));

const board = (id: string, name: string, position: number) => ({ id, name, position, archived_at: null, role: "owner" });

function renderCreate(props: Partial<Parameters<typeof QuickCreateTask>[0]> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const onClose = jest.fn();
  const onCreated = jest.fn();
  render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        MantineProvider,
        { env: "test" },
        createElement(QuickCreateTask, { opened: true, dueDate: "2026-08-25", onClose, onCreated, ...props }),
      ),
    ),
  );
  return { onClose, onCreated };
}

beforeEach(() => {
  mockCreateTask.mockReset();
  mockNotifySuccess.mockReset();
  dialogProps.current = null;
  window.localStorage.clear();
  mockListBoards.mockResolvedValue([board("b1", "Work", 0), board("b2", "Home", 1), { ...board("b3", "Old", 2), archived_at: "2026-01-01" }]);
});

describe("QuickCreateTask", () => {
  it("lets the user pick the board, then opens the task form on the chosen date", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(LAST_BOARD_STORAGE_KEY, "b1");
    renderCreate();
    const select = await screen.findByRole("textbox", { name: "Board" });
    // The board used last is suggested.
    await waitFor(() => expect(select).toHaveValue("Work"));
    await user.click(select);
    expect(screen.queryByRole("option", { name: "Old" })).toBeNull();
    await user.click(await screen.findByRole("option", { name: "Home" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    // The first open status, not the "Done" one that comes first.
    expect(await screen.findByTestId("task-dialog")).toHaveTextContent("New task in Home | b2 | b2-todo | 2026-08-25");
  });

  it("saves through the regular task creation and reports it", async () => {
    const created = { id: "new", title: "Dentist", parent: null, links: [], attachments: [] };
    mockCreateTask.mockResolvedValue(created);
    const { onCreated } = renderCreate({ boardId: "b2" });
    await screen.findByTestId("task-dialog");
    const payload: TaskCreate = {
      column_id: "b2-todo",
      category_id: "c1",
      title: "Dentist",
      start_date: "2026-08-25",
      due_date: "2026-08-25",
    };
    const onSubmit = dialogProps.current?.onSubmit as (p: TaskCreate, files: File[]) => Promise<unknown>;
    await act(async () => {
      await onSubmit(payload, []);
    });
    expect(mockCreateTask).toHaveBeenCalledWith(payload);
    expect(mockNotifySuccess).toHaveBeenCalledWith(expect.stringContaining("Dentist"));
    expect(onCreated).toHaveBeenCalledWith(created);
  });

  it("skips the board step when the board is known or there is only one", async () => {
    renderCreate({ boardId: "b1" });
    expect(await screen.findByTestId("task-dialog")).toHaveTextContent("b1 | b1-todo | 2026-08-25");
    expect(screen.queryByRole("textbox", { name: "Board" })).toBeNull();
  });

  it("goes straight to the form when there is a single board", async () => {
    mockListBoards.mockResolvedValue([board("only", "Solo", 0)]);
    renderCreate();
    await waitFor(() => expect(screen.getByTestId("task-dialog")).toHaveTextContent("only | only-todo"));
  });
});

describe("startingColumn", () => {
  it("prefers the first open, active status", () => {
    const column = (id: string, position: number, extra: Partial<ColumnDetail> = {}) =>
      ({ id, position, is_done: false, archived_at: null, ...extra }) as ColumnDetail;
    expect(
      startingColumn([column("archived", 0, { archived_at: "x" }), column("done", 1, { is_done: true }), column("todo", 2)])?.id,
    ).toBe("todo");
    expect(startingColumn([column("done", 0, { is_done: true })])?.id).toBe("done");
    expect(startingColumn([])).toBeNull();
  });
});
