import { expandRangeToInclude } from "./date-presets";
import { createSaveNotice, isTaskHiddenByFilters, isTaskInDateView } from "./task-visibility";

const task = {
  id: "1",
  column_id: "col",
  title: "Design review",
  description: null,
  content: null,
  content_text: "notes",
  content_schema_version: 1,
  start_date: "2026-08-13",
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
      { priorities: [], query: "", categoryIds: [], assigneeIds: [] },
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
      { priorities: ["high"], query: "", categoryIds: [], assigneeIds: [] },
    );
    expect(notice.outOfRange).toBe(false);
    expect(notice.hiddenByFilters).toBe(true);
    expect(notice.message).toContain("Task saved for");
  });
});

describe("saved task and the multi-select priority filter", () => {
  const view = { startDate: "2026-08-01", endDate: "2026-08-31", unbounded: false, dateField: "due_date" as const };

  it("does not warn when the task matches any selected priority", () => {
    const notice = createSaveNotice(task, view, { priorities: ["high", "medium"], query: "", categoryIds: [], assigneeIds: [] });
    expect(notice.hiddenByFilters).toBe(false);
  });

  it("warns when the task matches none of the selected priorities", () => {
    const notice = createSaveNotice(task, view, { priorities: ["high", "low"], query: "", categoryIds: [], assigneeIds: [] });
    expect(notice.hiddenByFilters).toBe(true);
  });

  it("still applies the other filters alongside the priorities", () => {
    const summary = { title: task.title, content_preview: task.content_text, priority: task.priority, category: task.category, assignees: [] };
    expect(isTaskHiddenByFilters(summary, { priorities: ["medium"], query: "", categoryIds: ["home"], assigneeIds: [] })).toBe(true);
    expect(isTaskHiddenByFilters(summary, { priorities: ["medium"], query: "design", categoryIds: ["work"], assigneeIds: [] })).toBe(false);
    expect(isTaskHiddenByFilters(summary, { priorities: [], query: "missing", categoryIds: [], assigneeIds: [] })).toBe(true);
  });
});
