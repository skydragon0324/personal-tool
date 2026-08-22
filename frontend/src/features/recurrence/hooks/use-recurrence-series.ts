import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";

import { recurrenceKeys } from "../api/recurrence-queries";
import type { RecurrenceSeriesListParams } from "../types";

export function useRecurrenceSeriesList(params: RecurrenceSeriesListParams) {
  return useQuery({
    queryKey: recurrenceKeys.list(params),
    queryFn: () => apiClient.listRecurrenceSeries(params),
  });
}

export function useRecurrenceSeriesDetail(seriesId: string, enabled: boolean) {
  return useQuery({
    queryKey: recurrenceKeys.detail(seriesId),
    queryFn: () => apiClient.getRecurrenceSeries(seriesId),
    enabled: enabled && Boolean(seriesId),
  });
}

/**
 * Summary cards use two extra list requests that share the board filter and
 * ignore the table page:
 * - active with limit 100 for the Active total and No-future count among those rows
 * - stopped with limit 1 for the Stopped total
 *
 * This avoids refetching every status for every table page. If more than 100
 * active series exist, the no-future count is taken from the first 100.
 */
export function useRecurrenceSeriesSummary(boardId?: string) {
  const active = useRecurrenceSeriesList({
    status: "active",
    board_id: boardId,
    offset: 0,
    limit: 100,
  });
  const stopped = useRecurrenceSeriesList({
    status: "stopped",
    board_id: boardId,
    offset: 0,
    limit: 1,
  });

  return {
    isLoading: active.isLoading || stopped.isLoading,
    isError: active.isError || stopped.isError,
    refetch: () => {
      void active.refetch();
      void stopped.refetch();
    },
    activeCount: active.data?.total ?? 0,
    stoppedCount: stopped.data?.total ?? 0,
    noFutureCount:
      active.data?.items.filter((item) => item.next_occurrence_date === null).length ?? 0,
  };
}
