import { describe, expect, it } from "vitest";

import type { TaskSummary } from "../types";
import { moveAnchors, shouldShowDateHeadings } from "./move-anchors";

const task = (id: string, position: number, dueDate = "2026-08-13"): TaskSummary => ({
  id,
  column_id: "todo",
  title: id,
  due_date: dueDate,
  priority: "medium",
  position,
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
});

describe("column-wide move anchors", () => {
  it("does not render date group headings", () => {
    expect(shouldShowDateHeadings()).toBe(false);
  });

  it("uses visible neighbors so filtered tasks do not shift the insert slot", () => {
    const visible = [task("alpha", 0), task("charlie", 2, "2026-08-20")];
    expect(moveAnchors([...visible, task("delta", 9)], "delta")).toEqual({
      after_task_id: "charlie",
      before_task_id: null,
    });
    expect(moveAnchors([task("delta", 9), ...visible], "delta")).toEqual({
      after_task_id: null,
      before_task_id: "alpha",
    });
  });
});
