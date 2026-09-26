"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";

import { boardKeys, memberKeys } from "../api/board-queries";
import type { BoardMembers } from "../types";

export function useBoardMembers(boardId: string, enabled = true) {
  return useQuery({
    queryKey: memberKeys.list(boardId),
    queryFn: () => apiClient.getBoardMembers(boardId),
    enabled,
    staleTime: 60_000,
  });
}

export function useBoardMemberMutations(boardId: string) {
  const queryClient = useQueryClient();

  function store(members: BoardMembers) {
    queryClient.setQueryData(memberKeys.list(boardId), members);
    void queryClient.invalidateQueries({ queryKey: boardKeys.list });
  }

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: memberKeys.list(boardId) });
    void queryClient.invalidateQueries({ queryKey: boardKeys.list });
    // Removing someone unassigns their tasks.
    void queryClient.invalidateQueries({ queryKey: boardKeys.views(boardId) });
  }

  const invite = useMutation({
    mutationFn: (email: string) => apiClient.inviteBoardMember(boardId, email),
    onSuccess: (result) => store(result.members),
  });

  const remove = useMutation({
    mutationFn: (userId: string) => apiClient.removeBoardMember(boardId, userId),
    onSettled: refresh,
  });

  const cancelInvitation = useMutation({
    mutationFn: (invitationId: string) => apiClient.cancelBoardInvitation(boardId, invitationId),
    onSettled: refresh,
  });

  return { invite, remove, cancelInvitation };
}
