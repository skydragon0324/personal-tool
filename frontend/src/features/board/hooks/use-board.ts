"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { boardKeys } from "../api/board-queries";
import type { BoardQueryParams } from "../types";

export function useBoard(params: BoardQueryParams) {
  return useQuery({
    queryKey: boardKeys.view(params),
    queryFn: () => apiClient.getBoardView(params),
    enabled: Boolean(params.boardId && (params.unbounded || (params.startDate && params.endDate))),
  });
}
