import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";

import type { TaskDetail } from "@/features/board/types";
import type { TaskHistoryEntry } from "@/features/tasks/types";

import { TaskDetailModal } from "./task-detail-modal";

const TASK: TaskDetail = {
  id: "task-1",
  column_id: "col-todo",
  title: "Design the database",
  description: null,
  content: null,
  content_text: null,
  content_schema_version: 1,
  start_date: "2026-10-24",
  due_date: "2026-10-24",
  priority: "medium",
  position: 0,
  version: 1,
  completed_at: null,
  created_at: "2026-10-24T00:00:00Z",
  updated_at: "2026-10-24T00:00:00Z",
  links: [],
  attachments: [],
  subtasks: [],
  category: { id: "cat-1", name: "Work", color: "blue" },
  recurrence: null,
};

let current: TaskDetail = TASK;
let history: TaskHistoryEntry[] = [];

jest.mock("@/lib/api-client", () => ({
  apiClient: { getTaskHistory: () => Promise.resolve(history) },
}));

jest.mock("@/features/board/hooks/use-task-detail", () => ({
  useTaskDetail: () => ({ data: current, isLoading: false, isError: false, refetch: jest.fn() }),
}));
jest.mock("./subtask-list", () => ({ SubtaskList: () => null }));
jest.mock("./task-content-viewer", () => ({ TaskContentViewer: () => null }));
// A stand-in form: "Edit title" makes an unsaved edit, "Save" finishes like a successful save.
jest.mock("./task-form", () => ({
  TaskForm: ({ onSaved, onDirtyChange }: { onSaved: () => void; onDirtyChange: (dirty: boolean) => void }) =>
    createElement(
      "div",
      null,
      createElement("button", { type: "button", onClick: () => onDirtyChange(true) }, "Edit title"),
      createElement("button", { type: "button", onClick: () => onSaved() }, "Save"),
    ),
}));

function renderModal(props: Partial<Parameters<typeof TaskDetailModal>[0]> = {}) {
  const onModeChange = jest.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(
      MantineProvider,
      { env: "test" },
      createElement(TaskDetailModal, {
        taskId: current.id,
        mode: "edit",
        boardId: "board-1",
        query: { boardId: "board-1", startDate: "2026-10-24", endDate: "2026-10-24", unbounded: true, dateField: "due_date" },
        columns: [],
        onModeChange,
        onClose: jest.fn(),
        onOpenTask: jest.fn(),
        onSubmit: jest.fn(),
        onDelete: jest.fn(),
        ...props,
      }),
      ),
    ),
  );
  return { onModeChange };
}

describe("TaskDetailModal", () => {
  beforeEach(() => {
    current = TASK;
    history = [];
  });

  it("shows who changed what in the history next to the details", async () => {
    history = [
      {
        id: "h2",
        created_at: "2026-10-25T09:30:00Z",
        actor_id: "u2",
        actor_name: "Mate",
        action: "updated",
        changes: [
          { field: "status", from: "To Do", to: "Done" },
          { field: "priority", from: "medium", to: "high" },
          { field: "assignees", added: ["Mate"], removed: ["Ada"] },
          { field: "details" },
        ],
      },
      { id: "h1", created_at: "2026-10-24T08:00:00Z", actor_id: "u1", actor_name: "Ada", action: "created", changes: [] },
    ];
    renderModal({ mode: "view" });
    expect(await screen.findByText("Mate made changes")).toBeInTheDocument();
    expect(screen.getByText("Ada created this task")).toBeInTheDocument();
    const history_ = screen.getByRole("complementary", { name: "History" });
    expect(history_).toHaveTextContent("Status: To Do → Done");
    expect(history_).toHaveTextContent("Priority: Medium → High");
    expect(history_).toHaveTextContent("Assignees: Added Mate; Removed Ada");
    expect(history_).toHaveTextContent("Edited the details");
  });

  it("goes back to the details after saving, without asking to discard changes", async () => {
    const { onModeChange } = renderModal();
    await userEvent.click(screen.getByRole("button", { name: "Edit title" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.queryByText("Discard changes?")).not.toBeInTheDocument();
    expect(onModeChange).toHaveBeenCalledWith("view");
    expect(screen.getByRole("heading", { name: "Design the database" })).toBeInTheDocument();
  });

  it("shows a sub-task with a button back to its parent", async () => {
    current = { ...TASK, id: "sub-1", title: "Draw the schema", parent: { id: "task-1", title: "Design the database" } };
    const onOpenTask = jest.fn();
    renderModal({ mode: "view", onOpenTask });
    await userEvent.click(screen.getByRole("button", { name: "Back to “Design the database”" }));
    expect(onOpenTask).toHaveBeenCalledWith("task-1");
  });
});
