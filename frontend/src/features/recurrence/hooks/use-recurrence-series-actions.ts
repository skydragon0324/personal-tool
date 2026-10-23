import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";

import { boardKeys } from "@/features/board/api/board-queries";
import { dashboardKeys } from "@/features/dashboard/hooks/use-dashboard";
import { todayKeys } from "@/features/today/api/today-queries";
import { apiClient } from "@/lib/api-client";
import { notifyApiError, notifySuccess } from "@/lib/notify";

import { recurrenceKeys } from "../api/recurrence-queries";
import { t } from "@/i18n";

export interface RecurrenceSeriesActionVars {
  seriesId: string;
  boardId: string;
}

async function invalidateRecurrenceAction(queryClient: QueryClient, boardId: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: recurrenceKeys.all }),
    queryClient.invalidateQueries({ queryKey: todayKeys.all }),
    queryClient.invalidateQueries({ queryKey: dashboardKeys.all }),
    queryClient.invalidateQueries({ queryKey: boardKeys.views(boardId) }),
  ]);
}

export function useRecurrenceSeriesActions() {
  const queryClient = useQueryClient();

  const pause = useMutation({
    mutationFn: ({ seriesId }: RecurrenceSeriesActionVars) => apiClient.stopRecurrence(seriesId),
    onSuccess: async (_data, vars) => {
      notifySuccess(t("recurring.paused"));
      await invalidateRecurrenceAction(queryClient, vars.boardId);
    },
    onError: (error) => {
      notifyApiError(error, t("recurring.couldNotPause"));
    },
  });

  const resume = useMutation({
    mutationFn: ({ seriesId }: RecurrenceSeriesActionVars) => apiClient.resumeRecurrence(seriesId),
    onSuccess: async (_data, vars) => {
      notifySuccess(t("recurring.resumed"));
      await invalidateRecurrenceAction(queryClient, vars.boardId);
    },
    onError: (error) => {
      notifyApiError(error, t("recurring.couldNotResume"));
    },
  });

  return { pause, resume };
}
