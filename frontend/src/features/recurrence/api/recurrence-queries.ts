import type { RecurrenceSeriesListParams } from "../types";

export const recurrenceKeys = {
  all: ["recurrence-series"] as const,
  lists: () => [...recurrenceKeys.all, "list"] as const,
  list: (params: RecurrenceSeriesListParams) => [...recurrenceKeys.lists(), params] as const,
  details: () => [...recurrenceKeys.all, "detail"] as const,
  detail: (seriesId: string) => [...recurrenceKeys.details(), seriesId] as const,
};
