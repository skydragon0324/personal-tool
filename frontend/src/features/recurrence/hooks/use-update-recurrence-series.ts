"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { boardKeys } from "@/features/board/api/board-queries";
import { dashboardKeys } from "@/features/dashboard/hooks/use-dashboard";
import { todayKeys } from "@/features/today/api/today-queries";
import { apiClient } from "@/lib/api-client";
import { notifyApiError, notifySuccess } from "@/lib/notify";

import { recurrenceKeys } from "../api/recurrence-queries";
import type { RecurrenceSeriesUpdatePayload } from "../types";
import { isStaleSeriesVersion } from "../utils/series-edit";

export function useUpdateRecurrenceSeries() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      seriesId,
      payload,
    }: {
      seriesId: string;
      boardId: string;
      payload: RecurrenceSeriesUpdatePayload;
    }) => apiClient.updateRecurrenceSeries(seriesId, payload),
    onSuccess: async (data, vars) => {
      queryClient.setQueryData(recurrenceKeys.detail(vars.seriesId), data);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: recurrenceKeys.all }),
        queryClient.invalidateQueries({ queryKey: recurrenceKeys.detail(vars.seriesId) }),
        queryClient.invalidateQueries({ queryKey: todayKeys.all }),
        queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
        queryClient.invalidateQueries({ queryKey: boardKeys.views(vars.boardId) }),
      ]);
      notifySuccess("Recurring task updated");
    },
    onError: (error) => {
      if (isStaleSeriesVersion(error)) return;
      notifyApiError(error, "Could not update recurring task");
    },
  });
}
