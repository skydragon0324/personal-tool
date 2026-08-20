import { todayISO } from "@/lib/dates";
import type { BoardColumn, TaskSummary, TasksByColumn } from "../types";

export interface StatusShare {
  columnId: string;
  name: string;
  color: string;
  count: number;
  percent: number;
}

export interface CategoryShare {
  id: string;
  name: string;
  color: string;
  count: number;
  percent: number;
}

export interface ProgressStats {
  total: number;
  completed: number;
  remaining: number;
  overdue: number;
  percent: number;
  hasCompletedStatus: boolean;
  byStatus: StatusShare[];
  byCategory: CategoryShare[];
}

export function flattenVisibleTasks(
  columns: BoardColumn[],
  tasksByColumn: TasksByColumn,
): Array<TaskSummary & { statusName: string; statusColor: string; statusIsDone: boolean }> {
  return columns.flatMap((column) =>
    (tasksByColumn[column.id] ?? []).map((task) => ({
      ...task,
      statusName: column.name,
      statusColor: column.color,
      statusIsDone: column.is_done,
    })),
  );
}

export function computeProgressStats(
  columns: BoardColumn[],
  tasksByColumn: TasksByColumn,
  today = todayISO(),
): ProgressStats {
  const tasks = flattenVisibleTasks(columns, tasksByColumn);
  const total = tasks.length;
  const hasCompletedStatus = columns.some((column) => column.is_done);
  const completed = tasks.filter((task) => task.statusIsDone).length;
  const remaining = total - completed;
  const overdue = tasks.filter((task) => !task.statusIsDone && task.due_date < today).length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  const byStatus: StatusShare[] = columns.map((column) => {
    const count = (tasksByColumn[column.id] ?? []).length;
    return {
      columnId: column.id,
      name: column.name,
      color: column.color,
      count,
      percent: total === 0 ? 0 : Math.round((count / total) * 100),
    };
  });

  const categoryMap = new Map<string, CategoryShare>();
  for (const task of tasks) {
    const key = task.category?.id ?? "none";
    const current = categoryMap.get(key) ?? {
      id: key,
      name: task.category?.name ?? "Uncategorized",
      color: task.category?.color ?? "gray",
      count: 0,
      percent: 0,
    };
    current.count += 1;
    categoryMap.set(key, current);
  }
  const byCategory = [...categoryMap.values()].map((item) => ({
    ...item,
    percent: total === 0 ? 0 : Math.round((item.count / total) * 100),
  }));

  return {
    total,
    completed,
    remaining,
    overdue,
    percent,
    hasCompletedStatus,
    byStatus,
    byCategory,
  };
}
