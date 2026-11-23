import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";

import { boardKeys } from "../api/board-queries";
import type { BoardListItem } from "../types";

export const folderKeys = { list: ["board-folders"] as const };

export function useBoardFolders() {
  return useQuery({ queryKey: folderKeys.list, queryFn: () => apiClient.listBoardFolders() });
}

export function useBoardFolderMutations() {
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: folderKeys.list });
    void queryClient.invalidateQueries({ queryKey: boardKeys.list });
  };

  const create = useMutation({
    mutationFn: (name: string) => apiClient.createBoardFolder(name),
    onSuccess: refresh,
  });
  const rename = useMutation({
    mutationFn: ({ folderId, name }: { folderId: string; name: string }) =>
      apiClient.renameBoardFolder(folderId, name),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (folderId: string) => apiClient.deleteBoardFolder(folderId),
    onSuccess: refresh,
  });
  const moveBoard = useMutation({
    mutationFn: ({ boardId, folderId }: { boardId: string; folderId: string | null }) =>
      apiClient.updateBoard(boardId, { folder_id: folderId }),
    onSuccess: refresh,
  });

  return { create, rename, remove, moveBoard };
}

/** Boards of one folder, or the ungrouped ones when `folderId` is null. */
export function boardsInFolder(boards: BoardListItem[], folderIds: Set<string>, folderId: string | null) {
  return boards.filter((board) => {
    const own = board.folder_id && folderIds.has(board.folder_id) ? board.folder_id : null;
    return own === folderId;
  });
}
