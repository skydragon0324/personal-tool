import type { CalendarTask } from "../types";

/** Drag type of calendar tasks; day cells accept only this type. */
export const CALENDAR_TASK_DRAG_TYPE = "calendar-task";

export function dayDropId(day: string): string {
  return `calendar-day:${day}`;
}

export interface CalendarDragData {
  task: CalendarTask;
}

export interface CalendarDropData {
  day: string;
}

function isDragData(value: unknown): value is CalendarDragData {
  const data = value as CalendarDragData | null | undefined;
  return Boolean(data && data.task && typeof data.task.id === "string" && typeof data.task.due_date === "string");
}

function isDropData(value: unknown): value is CalendarDropData {
  const data = value as CalendarDropData | null | undefined;
  return Boolean(data && typeof data.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.day));
}

/** The reschedule a finished drag asks for, or null (canceled, dropped outside a day, same day). */
export function rescheduleFromDrop(
  source: unknown,
  target: unknown,
  canceled = false,
): { task: CalendarTask; dueDate: string } | null {
  if (canceled || !isDragData(source) || !isDropData(target)) return null;
  if (source.task.due_date === target.day) return null;
  return { task: source.task, dueDate: target.day };
}
