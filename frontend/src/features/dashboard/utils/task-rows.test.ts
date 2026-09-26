import { describe, expect, it } from "vitest";

import type { DashboardTaskRow } from "../types";
import { dueBucket, filterRows, sortRows } from "./task-rows";

function row(overrides: Partial<DashboardTaskRow>): DashboardTaskRow {
  return {
    id: "t",
    title: "Task",
    board_id: "b1",
    board_name: "Personal",
    board_color: "teal",
    status_id: "s",
    status_name: "To Do",
    status_color: "slate",
    is_done: false,
    category_name: "General",
    category_color: "gray",
    priority: "medium",
    start_date: "2026-09-25",
    due_date: "2026-09-25",
    completed_at: null,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    assignees: [],
    subtask_total: 0,
    subtask_completed: 0,
    is_recurring: false,
    ...overrides,
  };
}

const TODAY = "2026-09-25";

describe("task rows", () => {
  it("buckets by due date", () => {
    expect(dueBucket(row({ due_date: "2026-09-24" }), TODAY)).toBe("overdue");
    expect(dueBucket(row({ due_date: TODAY }), TODAY)).toBe("today");
    expect(dueBucket(row({ due_date: "2026-10-02" }), TODAY)).toBe("week");
    expect(dueBucket(row({ due_date: "2026-10-03" }), TODAY)).toBe("later");
    expect(dueBucket(row({ due_date: "2026-09-01", is_done: true }), TODAY)).toBe("done");
  });

  it("filters by board, assignee, bucket and text", () => {
    const rows = [
      row({
        id: "a",
        title: "Invoice",
        board_id: "b1",
        assignees: [
          { id: "u1", display_name: "Ann" },
          { id: "u2", display_name: "Bo" },
        ],
      }),
      row({ id: "b", title: "Groceries", board_id: "b2", due_date: "2026-09-20" }),
    ];
    const base = { boardId: "", assigneeId: "", priority: "", query: "", bucket: "" as const };
    expect(filterRows(rows, { ...base, boardId: "b2" }, TODAY).map((r) => r.id)).toEqual(["b"]);
    expect(filterRows(rows, { ...base, assigneeId: "u1" }, TODAY).map((r) => r.id)).toEqual(["a"]);
    expect(filterRows(rows, { ...base, assigneeId: "unassigned" }, TODAY).map((r) => r.id)).toEqual(["b"]);
    expect(filterRows(rows, { ...base, bucket: "overdue" }, TODAY).map((r) => r.id)).toEqual(["b"]);
    expect(filterRows(rows, { ...base, query: "invo" }, TODAY).map((r) => r.id)).toEqual(["a"]);
  });

  it("sorts by priority then due date", () => {
    const rows = [
      row({ id: "low", priority: "low", due_date: "2026-09-20" }),
      row({ id: "high-late", priority: "high", due_date: "2026-09-30" }),
      row({ id: "high-soon", priority: "high", due_date: "2026-09-26" }),
    ];
    expect(sortRows(rows, "priority").map((r) => r.id)).toEqual(["high-soon", "high-late", "low"]);
    expect(sortRows(rows, "due").map((r) => r.id)).toEqual(["low", "high-soon", "high-late"]);
  });
});
