"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { boardKeys, columnKeys } from "../api/board-queries";
import type { ColumnDetail } from "../types";

export function useColumns(boardId: string, includeArchived = true) {
  return useQuery({
    queryKey: [...columnKeys.list(boardId), includeArchived] as const,
    queryFn: () => apiClient.listColumns(boardId, includeArchived),
    enabled: Boolean(boardId),
  });
}

export function useColumnMutations(boardId: string) {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: columnKeys.list(boardId) });
    await queryClient.invalidateQueries({ queryKey: boardKeys.views(boardId) });
  };

  const create = useMutation({
    mutationFn: (payload: { name: string; color?: string; is_done?: boolean }) =>
      apiClient.createColumn(boardId, payload),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({
      columnId,
      payload,
    }: {
      columnId: string;
      payload: { name?: string; color?: string; is_done?: boolean };
    }) => apiClient.updateColumn(columnId, payload),
    onSuccess: invalidate,
  });

  const reorder = useMutation({
    mutationFn: ({ columnId, targetPosition }: { columnId: string; targetPosition: number }) =>
      apiClient.reorderColumn(columnId, targetPosition),
    onSuccess: invalidate,
  });

  const archive = useMutation({
    mutationFn: ({
      columnId,
      moveToColumnId,
    }: {
      columnId: string;
      moveToColumnId?: string | null;
    }) => apiClient.archiveColumn(columnId, moveToColumnId),
    onSuccess: invalidate,
  });

  const restore = useMutation({
    mutationFn: (columnId: string) => apiClient.restoreColumn(columnId),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (columnId: string) => apiClient.deleteColumn(columnId),
    onSuccess: invalidate,
  });

  return { create, update, reorder, archive, restore, remove };
}

export function activeColumns(columns: ColumnDetail[] | undefined): ColumnDetail[] {
  return (columns ?? [])
    .filter((column) => !column.archived_at)
    .sort((a, b) => a.position - b.position);
}
