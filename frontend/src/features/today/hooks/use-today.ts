"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { scheduleKeys } from "@/features/schedule/hooks/use-schedule";

import { todayKeys } from "../api/today-queries";

export function useToday(date: string) {
  return useQuery({
    queryKey: todayKeys.day(date),
    queryFn: () => apiClient.getToday(date),
  });
}

export function useScheduleOccurrence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      entryId,
      occurrenceDate,
      isCompleted,
    }: {
      entryId: string;
      occurrenceDate: string;
      isCompleted: boolean;
    }) => apiClient.setScheduleOccurrence(entryId, occurrenceDate, { is_completed: isCompleted }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: todayKeys.all });
      await queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
    },
  });
}
