"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";

import { todayKeys } from "../api/today-queries";

export function useToday(date: string) {
  return useQuery({
    queryKey: todayKeys.day(date),
    queryFn: () => apiClient.getToday(date),
  });
}
