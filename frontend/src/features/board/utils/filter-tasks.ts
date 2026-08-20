import type { BoardFilters, TasksByColumn } from "../types";

export function filterTasksByColumn(
  tasksByColumn: TasksByColumn,
  filters: BoardFilters,
): TasksByColumn {
  const query = filters.query.trim().toLowerCase();
  const next: TasksByColumn = {};

  for (const [columnId, tasks] of Object.entries(tasksByColumn)) {
    next[columnId] = tasks.filter((task) => {
      if (filters.priority && task.priority !== filters.priority) return false;
      if (filters.categoryId && task.category?.id !== filters.categoryId) {
        return false;
      }
      if (query) {
        const haystack = `${task.title} ${task.content_preview}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }

  return next;
}
