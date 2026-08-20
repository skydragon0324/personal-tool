import { describe, expect, it } from "vitest";

import { expandRangeToInclude } from "./date-presets";
import { createSaveNotice, isTaskInDateView } from "./task-visibility";

const task = {
  id: "1",
  column_id: "col",
  title: "Design review",
  description: null,
  content: null,
  content_text: "notes",
  content_schema_version: 1,
  due_date: "2026-08-13",
  priority: "medium" as const,
  position: 0,
  version: 1,
  completed_at: null,
  created_at: "2026-08-19T12:00:00Z",
  updated_at: "2026-08-19T12:00:00Z",
  links: [],
  attachments: [],
  subtasks: [],
  category: { id: "work", name: "Work", color: "blue" },
};

describe("task visibility after save", () => {
  it("treats August 13 as inside this-month range", () => {
    expect(
      isTaskInDateView(task, {
        startDate: "2026-08-01",
        endDate: "2026-08-31",
        unbounded: false,
        dateField: "due_date",
      }),
    ).toBe(true);
  });

  it("does not apply out-of-range due dates to the current view", () => {
    const notice = createSaveNotice(
      task,
      {
        startDate: "2026-08-19",
        endDate: "2026-08-19",
        unbounded: false,
        dateField: "due_date",
      },
      { priority: "", query: "", categoryId: "" },
    );
    expect(notice.outOfRange).toBe(true);
    expect(notice.jumpDate).toBe("2026-08-13");
    expect(expandRangeToInclude(["2026-08-19", "2026-08-19"], notice.jumpDate)).toEqual([
      "2026-08-13",
      "2026-08-19",
    ]);
  });

  it("warns when remaining filters would still hide the task", () => {
    const notice = createSaveNotice(
      task,
      {
        startDate: "2026-08-01",
        endDate: "2026-08-31",
        unbounded: false,
        dateField: "due_date",
      },
      { priority: "high", query: "", categoryId: "" },
    );
    expect(notice.outOfRange).toBe(false);
    expect(notice.hiddenByFilters).toBe(true);
    expect(notice.message).toContain("Task saved for");
  });
});
