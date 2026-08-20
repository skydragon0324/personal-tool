import type { TaskSummary, TasksByColumn } from "../types";

/** Reindex positions after a local reorder (same-day lists). */
export function reindexColumnTasks(tasks: TaskSummary[]): TaskSummary[] {
  return tasks.map((task, index) => ({ ...task, position: index }));
}

export function itemsByColumnIds(
  tasksByColumn: TasksByColumn,
  columnIds: string[],
): TasksByColumn {
  const next: TasksByColumn = {};
  for (const columnId of columnIds) {
    next[columnId] = tasksByColumn[columnId] ?? [];
  }
  return next;
}
