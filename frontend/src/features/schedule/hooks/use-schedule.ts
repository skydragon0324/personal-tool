"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { todayKeys } from "@/features/today/api/today-queries";

import type { ScheduleEntryCreate, ScheduleEntryUpdate } from "../types";

export const scheduleKeys = {
  all: ["schedule"] as const,
  week: (weekStart: string, today: string) => ["schedule", weekStart, today] as const,
};

export function useSchedule(weekStart: string, today: string) {
  return useQuery({
    queryKey: scheduleKeys.week(weekStart, today),
    queryFn: () => apiClient.listSchedule(weekStart, today),
  });
}

export function useScheduleMutations(weekStart: string, today: string) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: scheduleKeys.week(weekStart, today) });
    void queryClient.invalidateQueries({ queryKey: todayKeys.all });
  };

  const create = useMutation({
    mutationFn: (payload: ScheduleEntryCreate) => apiClient.createSchedule(payload),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ entryId, payload }: { entryId: string; payload: ScheduleEntryUpdate }) =>
      apiClient.updateSchedule(entryId, payload),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (entryId: string) => apiClient.deleteSchedule(entryId),
    onSuccess: invalidate,
  });

  return { create, update, remove };
}
