import { render } from "@testing-library/react";
import { DragDropProvider } from "@dnd-kit/react";
import { describe, expect, it } from "vitest";

import type { TaskSummary } from "../types";
import { overlayTaskFromSource, TaskDragOverlay } from "./task-drag-overlay";

function task(id: string): TaskSummary {
  return {
    id,
    column_id: "col-todo",
    title: id,
    due_date: "2026-08-20",
    start_date: "2026-08-20",
    priority: "medium",
    position: 0,
    version: 1,
    completed_at: null,
    created_at: "2026-08-19T00:00:00Z",
    updated_at: "2026-08-19T00:00:00Z",
    content_preview: "",
    checklist_completed: 0,
    checklist_total: 0,
    link_count: 0,
    attachment_count: 0,
    subtask_total: 0,
    subtask_completed: 0,
    category: { id: "c", name: "Work", color: "blue" },
  };
}

describe("TaskDragOverlay", () => {
  const lookup = task("alpha");

  it("shows overlay content only while a drag source exists", () => {
    expect(overlayTaskFromSource({ id: "alpha" }, () => lookup)?.id).toBe("alpha");
    expect(overlayTaskFromSource(null, () => lookup)).toBeNull();
    expect(overlayTaskFromSource({ id: "" }, () => lookup)).toBeNull();
  });

  it("keeps an overlay host that is empty after drag has ended", () => {
    const { queryByText } = render(
      <DragDropProvider>
        <TaskDragOverlay resolveTask={() => lookup} />
      </DragDropProvider>,
    );
    expect(document.body.querySelector("[data-dnd-overlay]")).not.toBeNull();
    expect(queryByText("alpha")).toBeNull();
  });
});
