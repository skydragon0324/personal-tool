"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { boardKeys } from "../api/board-queries";
import type { BoardCreate, BoardListItem } from "../types";
import { clearBoardPreferences } from "../utils/board-preferences";

export function useBoards(includeArchived = true) {
  return useQuery({
    queryKey: [...boardKeys.list, includeArchived] as const,
    queryFn: () => apiClient.listBoards(includeArchived),
  });
}

export function useBoardMutations(currentBoardId?: string) {
  const queryClient = useQueryClient();

  const invalidate = async (boardId?: string) => {
    await queryClient.invalidateQueries({ queryKey: boardKeys.list });
    const target = boardId ?? currentBoardId;
    if (target) {
      await queryClient.invalidateQueries({ queryKey: boardKeys.detail(target) });
      await queryClient.invalidateQueries({ queryKey: boardKeys.views(target) });
    }
  };

  const create = useMutation({
    mutationFn: (payload: BoardCreate) => apiClient.createBoard(payload),
    onSuccess: (created) => invalidate(created.id),
  });

  const update = useMutation({
    mutationFn: ({
      boardId,
      payload,
    }: {
      boardId: string;
      payload: { name?: string; color?: string; icon_name?: string | null; timezone?: string };
    }) => apiClient.updateBoard(boardId, payload),
    onSuccess: (board) => invalidate(board.id),
  });

  const reorder = useMutation({
    mutationFn: ({ boardId, targetPosition }: { boardId: string; targetPosition: number }) =>
      apiClient.reorderBoard(boardId, targetPosition),
    onSuccess: (board) => invalidate(board.id),
  });

  const archive = useMutation({
    mutationFn: (boardId: string) => apiClient.archiveBoard(boardId),
    onSuccess: (board) => invalidate(board.id),
  });

  const restore = useMutation({
    mutationFn: (boardId: string) => apiClient.restoreBoard(boardId),
    onSuccess: (board) => invalidate(board.id),
  });

  const remove = useMutation({
    mutationFn: (boardId: string) => apiClient.deleteBoard(boardId),
    onSuccess: (_, boardId) => {
      clearBoardPreferences(boardId, window.localStorage);
      queryClient.removeQueries({ queryKey: boardKeys.detail(boardId) });
      queryClient.removeQueries({ queryKey: boardKeys.views(boardId) });
      void invalidate();
    },
  });

  return { create, update, reorder, archive, restore, remove };
}

export function activeBoards(boards: BoardListItem[] | undefined): BoardListItem[] {
  return (boards ?? [])
    .filter((board) => !board.archived_at)
    .sort((a, b) => a.position - b.position);
}
