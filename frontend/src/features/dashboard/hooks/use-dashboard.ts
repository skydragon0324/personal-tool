"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { todayISO } from "@/lib/dates";

export const dashboardKeys = {
  all: ["dashboard"] as const,
  summary: (today: string) => ["dashboard", "summary", today] as const,
};

export function useDashboardSummary(today = todayISO()) {
  return useQuery({
    queryKey: dashboardKeys.summary(today),
    queryFn: () => apiClient.getDashboardSummary(today),
  });
}
