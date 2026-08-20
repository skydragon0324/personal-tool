"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { categoryKeys } from "../api/board-queries";
import type { CategoryDetail } from "../types";

export function useCategories(boardId: string) {
  return useQuery({
    queryKey: categoryKeys.list(boardId),
    queryFn: () => apiClient.listCategories(boardId),
    enabled: Boolean(boardId),
  });
}

export function useCreateCategory(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; color: string }) =>
      apiClient.createCategory(boardId, payload),
    onSuccess: (created) => {
      queryClient.setQueryData<CategoryDetail[]>(categoryKeys.list(boardId), (current) => {
        if (!current) return [created];
        if (current.some((item) => item.id === created.id)) return current;
        return [...current, created].sort((a, b) => a.position - b.position);
      });
      void queryClient.invalidateQueries({ queryKey: categoryKeys.list(boardId) });
    },
  });
}
