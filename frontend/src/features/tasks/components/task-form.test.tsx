import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import type { TaskDetail } from "@/features/board/types";

import { TaskForm } from "./task-form";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      listCategories: vi
        .fn()
        .mockResolvedValue([
          { id: "cat-1", name: "Work", color: "blue", board_id: "board-1", position: 0, created_at: "" },
        ]),
      createCategory: vi.fn(),
      getBoardMembers: vi.fn().mockResolvedValue({
        can_manage: true,
        people: [{ user_id: "user-1", display_name: "Me", email: "me@example.com", role: "owner" }],
        invitations: [],
      }),
    },
  };
});

vi.mock("@/features/tasks/components/task-rich-text-editor", () => ({
  TaskRichTextEditor: () => createElement("div", { "data-testid": "rich-text" }, "editor"),
}));

const TASK: TaskDetail = {
  id: "task-1",
  column_id: "col-todo",
  title: "Server title",
  description: null,
  content: null,
  content_text: null,
  content_schema_version: 1,
  start_date: "2026-09-23",
  due_date: "2026-09-23",
  priority: "medium",
  position: 0,
  version: 1,
  completed_at: null,
  created_at: "2026-09-23T00:00:00Z",
  updated_at: "2026-09-23T00:00:00Z",
  links: [],
  attachments: [],
  subtasks: [],
  category: { id: "cat-1", name: "Work", color: "blue" },
  recurrence: null,
};

describe("TaskForm", () => {
  it("keeps unsaved edits when the same task is refetched (e.g. after an image upload)", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const tree = (initial: TaskDetail): ReactElement =>
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          MantineProvider,
          null,
          createElement(TaskForm, {
            initial,
            boardId: "board-1",
            columnId: initial.column_id,
            dueDate: initial.due_date,
            onSubmit: vi.fn(),
          }),
        ),
      );
    const { rerender } = render(tree(TASK));

    const title = screen.getByLabelText(/^Title/);
    expect(title).toHaveValue("Server title");
    await userEvent.clear(title);
    await userEvent.type(title, "Unsaved title");

    // A detail refetch hands the form a new object for the same task.
    rerender(tree({ ...TASK, attachments: [], updated_at: "2026-09-23T00:05:00Z" }));

    expect(screen.getByLabelText(/^Title/)).toHaveValue("Unsaved title");
  });

  it("leaves an existing reminder alone and sends the assignees", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const onSubmit = vi.fn().mockResolvedValue(TASK);
    render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          MantineProvider,
          { env: "test" },
          createElement(TaskForm, {
            initial: {
              ...TASK,
              remind_at: "2026-09-23T09:30:00Z",
              assignees: [{ id: "user-1", display_name: "Me", email: "me@example.com" }],
            },
            boardId: "board-1",
            columnId: TASK.column_id,
            dueDate: TASK.due_date,
            onSubmit,
          }),
        ),
      ),
    );

    await screen.findByDisplayValue("Work");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const payload = onSubmit.mock.calls[0][0];
    // Reminders are set from notifications ("Remind me"), so saving the form must not clear them.
    expect(payload).not.toHaveProperty("remind_at");
    expect(payload.assignee_ids).toEqual(["user-1"]);
  });
});
