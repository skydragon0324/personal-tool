"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { todayKeys } from "@/features/today/api/today-queries";
import { apiClient } from "@/lib/api-client";
import { notifyApiError } from "@/lib/notify";

import type { ScheduleOccurrence } from "../types";
import { patchScheduleOccurrenceCaches } from "../utils/occurrence-cache";
import { occurrenceKey } from "../utils/occurrence-state";
import { scheduleKeys } from "./use-schedule";

export interface ToggleScheduleOccurrence {
  entryId: string;
  occurrenceDate: string;
  isCompleted: boolean;
}

export function useScheduleOccurrence() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ entryId, occurrenceDate, isCompleted }: ToggleScheduleOccurrence) =>
      apiClient.setScheduleOccurrence(entryId, occurrenceDate, { is_completed: isCompleted }),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: scheduleKeys.all });
      await queryClient.cancelQueries({ queryKey: todayKeys.all });
      const previousSchedule = queryClient.getQueriesData({ queryKey: scheduleKeys.all });
      const previousToday = queryClient.getQueriesData({ queryKey: todayKeys.all });
      patchScheduleOccurrenceCaches(
        queryClient,
        vars,
        vars.isCompleted ? new Date().toISOString() : null,
      );
      return { previousSchedule, previousToday };
    },
    onError: (error, _vars, context) => {
      for (const [key, data] of context?.previousSchedule ?? []) {
        queryClient.setQueryData(key, data);
      }
      for (const [key, data] of context?.previousToday ?? []) {
        queryClient.setQueryData(key, data);
      }
      notifyApiError(error, "Could not update schedule");
    },
    onSuccess: (saved: ScheduleOccurrence) => {
      patchScheduleOccurrenceCaches(
        queryClient,
        {
          entryId: saved.schedule_entry_id,
          occurrenceDate: saved.occurrence_date,
          isCompleted: saved.is_completed,
        },
        saved.completed_at,
      );
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
      await queryClient.invalidateQueries({ queryKey: todayKeys.all });
    },
  });

  const pendingKey =
    mutation.isPending && mutation.variables
      ? occurrenceKey(mutation.variables.entryId, mutation.variables.occurrenceDate)
      : null;

  return { ...mutation, pendingKey };
}
