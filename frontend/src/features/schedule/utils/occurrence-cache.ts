import type { QueryClient } from "@tanstack/react-query";

import type { TodayResponse } from "@/features/today/types";

import type { ScheduleOccurrence, ScheduleWeek } from "../types";
import { addDays } from "./schedule-time";
import { occurrenceKey } from "./occurrence-state";

export function applyOccurrenceToWeek(
  current: ScheduleWeek,
  entryId: string,
  occurrenceDate: string,
  isCompleted: boolean,
  completedAt: string | null,
): ScheduleWeek {
  const nextItem: ScheduleOccurrence = {
    schedule_entry_id: entryId,
    occurrence_date: occurrenceDate,
    is_completed: isCompleted,
    completed_at: completedAt,
  };
  const remaining = current.occurrences.filter(
    (item) => occurrenceKey(item.schedule_entry_id, item.occurrence_date) !== occurrenceKey(entryId, occurrenceDate),
  );
  return { ...current, occurrences: [...remaining, nextItem] };
}

export function dateInWeek(weekStart: string, occurrenceDate: string): boolean {
  return occurrenceDate >= weekStart && occurrenceDate <= addDays(weekStart, 6);
}

export function patchScheduleOccurrenceCaches(
  queryClient: QueryClient,
  vars: { entryId: string; occurrenceDate: string; isCompleted: boolean },
  completedAt: string | null,
): void {
  queryClient.setQueriesData<ScheduleWeek>({ queryKey: ["schedule"] }, (current) => {
    if (!current?.occurrences || !current.week_start) return current;
    if (!dateInWeek(current.week_start, vars.occurrenceDate)) return current;
    return applyOccurrenceToWeek(current, vars.entryId, vars.occurrenceDate, vars.isCompleted, completedAt);
  });
  queryClient.setQueriesData<TodayResponse>({ queryKey: ["today"] }, (current) => {
    if (!current || current.date !== vars.occurrenceDate) return current;
    return {
      ...current,
      schedules: current.schedules.map((item) =>
        item.id === vars.entryId
          ? { ...item, is_completed: vars.isCompleted, completed_at: completedAt }
          : item,
      ),
    };
  });
}
