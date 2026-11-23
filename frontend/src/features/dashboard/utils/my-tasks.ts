import type { DashboardTaskRow } from "../types";

/** A task is yours when it is assigned to you, or when nobody has been assigned yet. */
export function isMyTask(row: Pick<DashboardTaskRow, "assignees">, userId: string | undefined): boolean {
  return !row.assignees.length || row.assignees.some((person) => person.id === userId);
}
