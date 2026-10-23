import type { BoardView, TaskDetail } from "../types";
import { applyDetailToView } from "./board-queries";

function view(): BoardView {
  return {
    columns: [{ id: "col-todo", is_done: false, tasks: [] }],
  } as unknown as BoardView;
}

function detail(overrides: Partial<TaskDetail> = {}): TaskDetail {
  return {
    id: "task-1",
    column_id: "col-todo",
    title: "Write report",
    description: null,
    content: null,
    content_text: null,
    content_schema_version: 1,
    start_date: "2026-10-21",
    due_date: "2026-10-21",
    priority: "medium",
    position: 0,
    version: 1,
    completed_at: null,
    created_at: "2026-10-21T00:00:00Z",
    updated_at: "2026-10-21T00:00:00Z",
    links: [],
    attachments: [],
    subtasks: [],
    category: { id: "cat-1", name: "General", color: "gray" },
    ...overrides,
  } as TaskDetail;
}

describe("applyDetailToView", () => {
  it("puts a saved task on its column", () => {
    const next = applyDetailToView(view(), detail());
    expect(next.columns[0].tasks.map((task) => task.id)).toEqual(["task-1"]);
  });

  it("never puts a sub-task on the board", () => {
    const before = view();
    const next = applyDetailToView(before, detail({ parent: { id: "parent-1", title: "Parent" } }));
    expect(next).toBe(before);
    expect(next.columns[0].tasks).toEqual([]);
  });
});
