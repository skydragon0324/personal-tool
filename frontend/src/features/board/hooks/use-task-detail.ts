"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { taskKeys } from "../api/board-queries";

export function useTaskDetail(taskId: string | null) {
  return useQuery({
    queryKey: taskKeys.detail(taskId ?? ""),
    queryFn: () => apiClient.getTask(taskId!),
    enabled: Boolean(taskId),
  });
}
