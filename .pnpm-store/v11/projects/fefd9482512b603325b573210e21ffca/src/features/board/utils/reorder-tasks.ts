import type { TaskSummary } from "../types";

/** Reindex positions after a local reorder (same-day lists). */
export function reindexColumnTasks(tasks: TaskSummary[]): TaskSummary[] {
  return tasks.map((task, index) => ({ ...task, position: index }));
}
