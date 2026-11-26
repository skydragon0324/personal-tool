import { dashboardKeys } from "@/features/dashboard/hooks/use-dashboard";

import type { CalendarRange } from "../types";

/**
 * Calendar queries live under the dashboard key: every task mutation already refreshes
 * `dashboardKeys.all`, so creating, editing, moving or deleting a task anywhere refreshes the
 * calendar too.
 */
export const calendarKeys = {
  all: [...dashboardKeys.all, "calendar"] as const,
  range: (range: CalendarRange, boardId: string | null) =>
    [...calendarKeys.all, range.start, range.end, boardId ?? "all"] as const,
};
