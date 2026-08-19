"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { boardKeys } from "../api/board-queries";

export function useBoard(boardId: string, startDate: string, endDate: string) {
  return useQuery({
    queryKey: boardKeys.view(boardId, startDate, endDate),
    queryFn: () => apiClient.getBoardView(boardId, startDate, endDate),
    enabled: Boolean(boardId && startDate && endDate),
  });
}
