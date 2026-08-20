import type { DeadlineStatus } from "../types";

export const DEADLINE_STATUS_LABEL: Record<DeadlineStatus, string> = {
  overdue: "Overdue",
  due_today: "Due today",
  starts_today: "Starts today",
  in_progress: "In progress",
  completed: "Completed",
};

export const SCHEDULE_KIND_LABEL = {
  routine: "Routine",
  this_week: "This week only",
} as const;
