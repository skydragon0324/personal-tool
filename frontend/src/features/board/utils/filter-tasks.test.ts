import { describe, expect, it } from "vitest";

import type { TaskSummary } from "../types";
import { UNASSIGNED, filterTasksByColumn } from "./filter-tasks";

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

describe("assignee filter", () => {
  const category = { id: "cat", name: "Work", color: "blue" };
  const ann = { id: "user-ann", display_name: "Ann", email: "ann@example.com" };
  const tasks = {
    "col-1": [
      task({ id: "a", title: "Ann's", category, assignees: [ann, { id: "user-bo", display_name: "Bo", email: "bo@example.com" }] }),
      task({ id: "b", title: "Nobody's", category, assignees: [] }),
    ],
  };
  const base = { priority: "" as const, query: "", categoryId: "" };

  it("keeps everything by default", () => {
    expect(filterTasksByColumn(tasks, base)["col-1"].map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("filters by person or unassigned", () => {
    expect(
      filterTasksByColumn(tasks, { ...base, assigneeId: "user-ann" })["col-1"].map((item) => item.id),
    ).toEqual(["a"]);
    expect(
      filterTasksByColumn(tasks, { ...base, assigneeId: UNASSIGNED })["col-1"].map((item) => item.id),
    ).toEqual(["b"]);
  });
});
