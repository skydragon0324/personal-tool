import type { BoardFilters, Priority, TasksByColumn } from "../types";

export const UNASSIGNED = "unassigned";

/** OR across the selected priorities; no selection matches every priority. */
export function matchesPriorities(priority: Priority, selected: readonly Priority[]): boolean {
  return !selected.length || selected.includes(priority);
}

/** OR within the category filter; no selection shows every category. */
export function matchesCategories(categoryId: string | undefined, selected: readonly string[]): boolean {
  return !selected.length || Boolean(categoryId && selected.includes(categoryId));
}

/** OR within the assignee filter, including the synthetic unassigned choice. */
export function matchesAssignees(
  assignees: readonly { id: string }[],
  selected: readonly string[],
): boolean {
  if (!selected.length) return true;
  if (!assignees.length && selected.includes(UNASSIGNED)) return true;
  return assignees.some((person) => selected.includes(person.id));
}

export function filterTasksByColumn(
  tasksByColumn: TasksByColumn,
  filters: BoardFilters,
): TasksByColumn {
  const query = filters.query.trim().toLowerCase();
  const next: TasksByColumn = {};

  for (const [columnId, tasks] of Object.entries(tasksByColumn)) {
    next[columnId] = tasks.filter((task) => {
      if (!matchesPriorities(task.priority, filters.priorities)) return false;
      if (!matchesCategories(task.category?.id, filters.categoryIds)) return false;
      const assignees = task.assignees ?? [];
      if (!matchesAssignees(assignees, filters.assigneeIds)) return false;
      if (query) {
        const haystack = `${task.title} ${task.content_preview}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }

  return next;
}
