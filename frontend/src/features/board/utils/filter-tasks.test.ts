import type { Priority, TaskSummary } from "../types";
import { UNASSIGNED, filterTasksByColumn, matchesPriorities } from "./filter-tasks";

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

  it("filters by any selected category", () => {
    const filtered = filterTasksByColumn(tasks, {
      priorities: [],
      query: "",
      categoryIds: [personal.id, "cat-missing"],
      assigneeIds: [],
    });
    expect(filtered["col-1"].map((item) => item.id)).toEqual(["1"]);
  });

  it("combines category, priority, and search filters", () => {
    const filtered = filterTasksByColumn(tasks, {
      priorities: ["high"],
      query: "milk",
      categoryIds: [personal.id],
      assigneeIds: [],
    });
    expect(filtered["col-1"]).toHaveLength(1);
    expect(filtered["col-1"][0].id).toBe("1");
  });

  it("shows all categories when the filter is empty", () => {
    const filtered = filterTasksByColumn(tasks, {
      priorities: [],
      query: "",
      categoryIds: [],
      assigneeIds: [],
    });
    expect(filtered["col-1"]).toHaveLength(2);
  });
});

describe("assignee filter", () => {
  const category = { id: "cat", name: "Work", color: "blue" };
  const ann = { id: "user-ann", display_name: "Ann", login_id: "ann" };
  const tasks = {
    "col-1": [
      task({ id: "a", title: "Ann's", category, assignees: [ann, { id: "user-bo", display_name: "Bo", login_id: "bo" }] }),
      task({ id: "b", title: "Nobody's", category, assignees: [] }),
    ],
  };
  const base = { priorities: [], query: "", categoryIds: [], assigneeIds: [] };

  it("keeps everything by default", () => {
    expect(filterTasksByColumn(tasks, base)["col-1"].map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("filters by any selected person or unassigned", () => {
    expect(
      filterTasksByColumn(tasks, { ...base, assigneeIds: ["user-ann"] })["col-1"].map((item) => item.id),
    ).toEqual(["a"]);
    expect(
      filterTasksByColumn(tasks, { ...base, assigneeIds: [UNASSIGNED] })["col-1"].map((item) => item.id),
    ).toEqual(["b"]);
    expect(
      filterTasksByColumn(tasks, { ...base, assigneeIds: ["user-ann", UNASSIGNED] })["col-1"].map((item) => item.id),
    ).toEqual(["a", "b"]);
  });
});

describe("multi-select priority filter", () => {
  const category = { id: "cat", name: "Work", color: "blue" };
  const other = { id: "cat-other", name: "Home", color: "teal" };
  const ann = { id: "user-ann", display_name: "Ann", login_id: "ann" };
  const tasks = {
    "col-1": [
      task({ id: "h", title: "Ship release", category, priority: "high", assignees: [ann] }),
      task({ id: "m", title: "Ship docs", category, priority: "medium" }),
      task({ id: "l", title: "Tidy desk", category, priority: "low", assignees: [ann] }),
      task({ id: "h2", title: "Ship groceries", category: other, priority: "high" }),
    ],
  };
  const ids = (filters: Parameters<typeof filterTasksByColumn>[1]) =>
    filterTasksByColumn(tasks, filters)["col-1"].map((item) => item.id);
  const base = { priorities: [] as Priority[], query: "", categoryIds: [] as string[], assigneeIds: [] as string[] };

  it("shows every priority when nothing is selected", () => {
    expect(ids(base)).toEqual(["h", "m", "l", "h2"]);
  });

  it("shows only the selected priority", () => {
    expect(ids({ ...base, priorities: ["low"] })).toEqual(["l"]);
  });

  it("shows tasks matching any selected priority", () => {
    expect(ids({ ...base, priorities: ["high", "low"] })).toEqual(["h", "l", "h2"]);
    expect(ids({ ...base, priorities: ["high", "medium", "low"] })).toEqual(["h", "m", "l", "h2"]);
  });

  it("combines with category, assignee and search filters", () => {
    expect(ids({ ...base, priorities: ["high", "medium"], categoryIds: [category.id] })).toEqual(["h", "m"]);
    expect(ids({ ...base, priorities: ["high", "low"], assigneeIds: [ann.id] })).toEqual(["h", "l"]);
    expect(ids({ ...base, priorities: ["high", "medium"], query: "ship" })).toEqual(["h", "m", "h2"]);
    expect(ids({ ...base, priorities: ["medium", "low"], query: "ship", assigneeIds: [UNASSIGNED] })).toEqual(["m"]);
  });
});

describe("matchesPriorities", () => {
  it("matches everything for an empty selection and uses OR otherwise", () => {
    expect(matchesPriorities("low", [])).toBe(true);
    expect(matchesPriorities("low", ["high", "low"])).toBe(true);
    expect(matchesPriorities("medium", ["high", "low"])).toBe(false);
  });
});
