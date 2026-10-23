import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";

import type { BoardQueryParams, TaskSubtask } from "@/features/board/types";

import { SubtaskList } from "./subtask-list";

const updateSubtask = jest.fn();
const createSubtask = jest.fn();

jest.mock("@/lib/api-client", () => {
  const actual = jest.requireActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      updateSubtask: (...args: unknown[]) => updateSubtask(...args),
      createSubtask: (...args: unknown[]) => createSubtask(...args),
    },
  };
});

const QUERY: BoardQueryParams = {
  boardId: "board-1",
  startDate: "2026-10-21",
  endDate: "2026-10-21",
  dateField: "due_date",
  unbounded: true,
};

function subtask(overrides: Partial<TaskSubtask> = {}): TaskSubtask {
  return {
    id: "sub-1",
    task_id: "parent-1",
    title: "Draft the outline",
    is_completed: false,
    position: 0,
    column_id: "col-todo",
    start_date: "2026-10-21",
    due_date: "2026-10-24",
    priority: "high",
    completed_at: null,
    assignees: [],
    created_at: "2026-10-21T00:00:00Z",
    updated_at: "2026-10-21T00:00:00Z",
    ...overrides,
  };
}

function renderList(items: TaskSubtask[], handlers: { onOpen?: jest.Mock; onDelete?: jest.Mock } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onOpen = handlers.onOpen ?? jest.fn();
  const onDelete = handlers.onDelete ?? jest.fn();
  render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        MantineProvider,
        null,
        createElement(SubtaskList, { taskId: "parent-1", query: QUERY, subtasks: items, onOpen, onDelete }),
      ),
    ),
  );
  return { onOpen, onDelete };
}

describe("SubtaskList", () => {
  beforeEach(() => {
    updateSubtask.mockReset();
    createSubtask.mockReset();
  });

  it("shows each sub-task with its due date and priority, and opens it as a full task", async () => {
    const { onOpen } = renderList([subtask()]);
    expect(screen.getByText("Sat, Oct 24")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^Draft the outline/ }));
    expect(onOpen).toHaveBeenCalledWith("sub-1");
  });

  it("ticks a sub-task done through the sub-task API", async () => {
    updateSubtask.mockResolvedValue(subtask({ is_completed: true }));
    renderList([subtask()]);
    await userEvent.click(screen.getByRole("checkbox", { name: "Mark Draft the outline done" }));
    await waitFor(() =>
      expect(updateSubtask).toHaveBeenCalledWith("parent-1", "sub-1", { is_completed: true }),
    );
  });

  it("asks the page to confirm deletes instead of deleting right away", async () => {
    const item = subtask();
    const { onDelete } = renderList([item]);
    await userEvent.click(screen.getByRole("button", { name: "Delete Draft the outline" }));
    expect(onDelete).toHaveBeenCalledWith(item);
  });

  it("adds a sub-task by title", async () => {
    createSubtask.mockResolvedValue(subtask({ id: "sub-2", title: "Review" }));
    renderList([]);
    await userEvent.type(screen.getByRole("textbox", { name: "Add a subtask" }), "Review{Enter}");
    await waitFor(() => expect(createSubtask).toHaveBeenCalledWith("parent-1", { title: "Review" }));
  });
});
