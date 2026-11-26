import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";

import { calendarKeys } from "../api/calendar-queries";
import type { CalendarRange } from "../types";

/** Tasks due in exactly the visible range. Changing the range starts a new request (and cancels
 * the previous one through the query's abort signal). */
export function useCalendarTasks(range: CalendarRange, boardId: string | null) {
  return useQuery({
    queryKey: calendarKeys.range(range, boardId),
    queryFn: ({ signal }) =>
      apiClient.getCalendarTasks({ startDate: range.start, endDate: range.end, boardId }, signal),
  });
}
