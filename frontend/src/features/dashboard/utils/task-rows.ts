import type { DashboardTaskRow } from "../types";

export type DueBucket = "overdue" | "today" | "week" | "later" | "done";

export const DUE_BUCKET_LABELS: Record<DueBucket, string> = {
  overdue: "Overdue",
  today: "Due today",
  week: "Next 7 days",
  later: "Later",
  done: "Completed",
};

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day + days);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function dueBucket(row: DashboardTaskRow, today: string): DueBucket {
  if (row.is_done) return "done";
  if (row.due_date < today) return "overdue";
  if (row.due_date === today) return "today";
  if (row.due_date <= addDays(today, 7)) return "week";
  return "later";
}

export type TaskSort = "due" | "priority" | "board" | "updated";

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;

export function sortRows(rows: DashboardTaskRow[], sort: TaskSort): DashboardTaskRow[] {
  const copy = [...rows];
  const byDue = (a: DashboardTaskRow, b: DashboardTaskRow) =>
    a.due_date.localeCompare(b.due_date) || a.title.localeCompare(b.title);
  switch (sort) {
    case "priority":
      return copy.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || byDue(a, b));
    case "board":
      return copy.sort((a, b) => a.board_name.localeCompare(b.board_name) || byDue(a, b));
    case "updated":
      return copy.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    default:
      return copy.sort(byDue);
  }
}

export interface TaskRowFilters {
  boardId: string;
  /** "" = anyone, "unassigned", or a user id. */
  assigneeId: string;
  priority: string;
  query: string;
  bucket: DueBucket | "";
}

export function filterRows(rows: DashboardTaskRow[], filters: TaskRowFilters, today: string): DashboardTaskRow[] {
  const query = filters.query.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.boardId && row.board_id !== filters.boardId) return false;
    if (filters.assigneeId === "unassigned" && row.assignees.length) return false;
    if (
      filters.assigneeId &&
      filters.assigneeId !== "unassigned" &&
      !row.assignees.some((person) => person.id === filters.assigneeId)
    ) {
      return false;
    }
    if (filters.priority && row.priority !== filters.priority) return false;
    if (filters.bucket && dueBucket(row, today) !== filters.bucket) return false;
    if (query && !`${row.title} ${row.board_name} ${row.category_name}`.toLowerCase().includes(query)) {
      return false;
    }
    return true;
  });
}
