import { describe, expect, it } from "vitest";

import type { TaskSummary } from "../types";
import { filterTasksByColumn } from "./filter-tasks";

const task = (
  overrides: Partial<TaskSummary> & Pick<TaskSummary, "id" | "title" | "category">,
): TaskSummary => ({
  column_id: "col-1",
  due_date: "2026-08-19",
  start_date: "2026-08-19",
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
  ...overrides,
});

describe("filterTasksByColumn", () => {
  const personal = { id: "cat-personal", name: "Personal", color: "teal" };
  const work = { id: "cat-work", name: "Work", color: "blue" };
  const tasks = {
    "col-1": [
      task({ id: "1", title: "Buy milk", category: personal, priority: "high" }),
      task({ id: "2", title: "Write docs", category: work, content_preview: "API notes" }),
    ],
  };

  it("filters by category id", () => {
    const filtered = filterTasksByColumn(tasks, {
      priority: "",
      query: "",
      categoryId: personal.id,
    });
    expect(filtered["col-1"].map((item) => item.id)).toEqual(["1"]);
  });

  it("combines category, priority, and search filters", () => {
    const filtered = filterTasksByColumn(tasks, {
      priority: "high",
      query: "milk",
      categoryId: personal.id,
    });
    expect(filtered["col-1"]).toHaveLength(1);
    expect(filtered["col-1"][0].id).toBe("1");
  });

  it("shows all categories when the filter is empty", () => {
    const filtered = filterTasksByColumn(tasks, {
      priority: "",
      query: "",
      categoryId: "",
    });
    expect(filtered["col-1"]).toHaveLength(2);
  });
});
