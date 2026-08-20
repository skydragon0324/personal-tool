import type { BoardFilters, TaskDetail, TaskSummary } from "../types";
import { createdAtDate, dateInRange, type DateField } from "./date-presets";

export interface DateViewState {
  startDate: string | null;
  endDate: string | null;
  unbounded: boolean;
  dateField: DateField;
}

export function taskDateValue(
  task: Pick<TaskSummary, "due_date" | "created_at">,
  dateField: DateField,
): string {
  return dateField === "created_at" ? createdAtDate(task.created_at) : task.due_date;
}

export function isTaskInDateView(
  task: Pick<TaskSummary, "due_date" | "created_at">,
  view: DateViewState,
): boolean {
  return dateInRange(
    taskDateValue(task, view.dateField),
    view.startDate,
    view.endDate,
    view.unbounded,
  );
}

export function isTaskHiddenByFilters(
  task: Pick<TaskSummary, "title" | "content_preview" | "priority" | "category">,
  filters: BoardFilters,
): boolean {
  if (filters.priority && task.priority !== filters.priority) return true;
  if (filters.categoryId && task.category?.id !== filters.categoryId) return true;
  const query = filters.query.trim().toLowerCase();
  if (query) {
    const haystack = `${task.title} ${task.content_preview ?? ""}`.toLowerCase();
    if (!haystack.includes(query)) return true;
  }
  return false;
}

export function createSaveNotice(
  task: TaskDetail,
  view: DateViewState,
  filters: BoardFilters,
): {
  message: string;
  outOfRange: boolean;
  hiddenByFilters: boolean;
  jumpDate: string;
} {
  const jumpDate = taskDateValue(task, view.dateField);
  return {
    message: `Task saved for ${task.due_date}`,
    outOfRange: !isTaskInDateView(task, view),
    hiddenByFilters: isTaskHiddenByFilters(
      {
        title: task.title,
        content_preview: task.content_text || task.description || "",
        priority: task.priority,
        category: task.category,
      },
      filters,
    ),
    jumpDate,
  };
}
