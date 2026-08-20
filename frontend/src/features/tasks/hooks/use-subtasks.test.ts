import { describe, expect, it } from "vitest";

import { canAddSubtask, subtaskProgressLabel } from "../hooks/use-subtasks";
import type { TaskSubtask } from "@/features/board/types";

const item = (id: string, completed: boolean): TaskSubtask => ({
  id,
  task_id: "task",
  title: id,
  is_completed: completed,
  position: 0,
  created_at: "2026-08-19T00:00:00Z",
  updated_at: "2026-08-19T00:00:00Z",
});

describe("subtask progress", () => {
  it("formats completed counts separately from checklist items", () => {
    expect(subtaskProgressLabel([item("a", true), item("b", false), item("c", true)])).toBe(
      "2 of 3 completed",
    );
  });

  it("enables add only when the title is non-empty and not saving", () => {
    expect(canAddSubtask("", false)).toBe(false);
    expect(canAddSubtask("   ", false)).toBe(false);
    expect(canAddSubtask("Outline", true)).toBe(false);
    expect(canAddSubtask("Outline", false)).toBe(true);
  });
});
