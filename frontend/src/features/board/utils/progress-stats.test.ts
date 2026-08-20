import { describe, expect, it } from "vitest";

import { computeProgressStats } from "./progress-stats";
import type { BoardColumn, TaskSummary, TasksByColumn } from "../types";

function column(partial: Partial<BoardColumn> & Pick<BoardColumn, "id" | "name" | "is_done">): BoardColumn {
  return {
    color: "teal",
    icon_name: null,
    position: 0,
    archived_at: null,
    tasks: [],
    ...partial,
  };
}

function task(partial: Partial<TaskSummary> & Pick<TaskSummary, "id" | "column_id" | "title" | "due_date">): TaskSummary {
  return {
    priority: "medium",
    position: 0,
    version: 1,
    completed_at: null,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    content_preview: "",
    checklist_completed: 0,
    checklist_total: 0,
    subtask_completed: 0,
    subtask_total: 0,
    link_count: 0,
    attachment_count: 0,
    category: { id: "c1", name: "Work", color: "blue" },
    ...partial,
  };
}

describe("progress stats", () => {
  it("uses column.is_done and returns 0% when there are no tasks", () => {
    const columns = [
      column({ id: "todo", name: "To do", is_done: false }),
      column({ id: "done", name: "Done", is_done: true }),
    ];
    const empty: TasksByColumn = { todo: [], done: [] };
    const stats = computeProgressStats(columns, empty, "2026-08-19");
    expect(stats.percent).toBe(0);
    expect(Number.isNaN(stats.percent)).toBe(false);
    expect(stats.hasCompletedStatus).toBe(true);
  });

  it("does not treat a status name as completed", () => {
    const columns = [column({ id: "done-name", name: "Done", is_done: false })];
    const tasksByColumn: TasksByColumn = {
      "done-name": [
        task({
          id: "t1",
          column_id: "done-name",
          title: "Named done",
          due_date: "2026-08-01",
        }),
      ],
    };
    const stats = computeProgressStats(columns, tasksByColumn, "2026-08-19");
    expect(stats.completed).toBe(0);
    expect(stats.overdue).toBe(1);
    expect(stats.hasCompletedStatus).toBe(false);
    expect(stats.percent).toBe(0);
  });
});
