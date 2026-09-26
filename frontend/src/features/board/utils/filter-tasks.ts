import type { BoardFilters, TasksByColumn } from "../types";

export const UNASSIGNED = "unassigned";

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
      const assignees = task.assignees ?? [];
      if (filters.assigneeId === UNASSIGNED && assignees.length) return false;
      if (
        filters.assigneeId &&
        filters.assigneeId !== UNASSIGNED &&
        !assignees.some((person) => person.id === filters.assigneeId)
      ) {
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
