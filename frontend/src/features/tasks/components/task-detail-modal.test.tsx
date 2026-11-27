import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
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

  it("opens image files in the image viewer and keeps other files as links", async () => {
    const file = (id: string, kind: string, name: string) => ({
      id,
      original_name: name,
      content_type: kind === "image" ? "image/png" : "application/pdf",
      size_bytes: 1,
      attachment_kind: kind,
      created_at: "2026-11-01T00:00:00Z",
      download_url: `/files/${id}`,
    });
    current = {
      ...TASK,
      attachments: [file("a", "image", "one.png"), file("spec", "file", "spec.pdf"), file("b", "image", "two.png")],
    };
    const onClose = jest.fn();
    const user = userEvent.setup();
    renderModal({ mode: "view", onClose });

    expect(screen.getByRole("link", { name: "spec.pdf" })).toHaveAttribute("href", "/files/spec");
    expect(screen.queryByRole("link", { name: "one.png" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open full image: two.png" }));
    const viewer = await screen.findByRole("dialog", { name: "two.png" });
    expect(viewer.querySelector("img")?.getAttribute("src")).toBe("/files/b");
    expect(viewer).toHaveTextContent("2 of 2");

    // Escape closes only the image viewer, not the task behind it.
    await waitFor(() => expect(viewer).toContainElement(document.activeElement as HTMLElement));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "two.png" })).not.toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
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
