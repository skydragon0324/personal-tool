import type { BoardListItem } from "@/features/board/types";

/** Drag type for sidebar board rows; folder drop targets accept only this type. */
export const SIDEBAR_BOARD_DRAG_TYPE = "sidebar-board";

/** Drop target id of the ungrouped (no folder) area. */
export const UNGROUPED_DROP_ID = "board-folder:none";

export function folderDropId(folderId: string | null): string {
  return folderId ? `board-folder:${folderId}` : UNGROUPED_DROP_ID;
}

export interface BoardDragData {
  boardId: string;
  /** The folder the board is shown in (null when ungrouped). */
  folderId: string | null;
}

export interface FolderDropData {
  /** null for the ungrouped area. */
  folderId: string | null;
}

/** Folders are personal, so only the owner's (non-shared) boards can be moved between them. */
export function canMoveBoardToFolder(board: Pick<BoardListItem, "role">): boolean {
  return board.role !== "member";
}

function isBoardDragData(value: unknown): value is BoardDragData {
  const data = value as BoardDragData | null | undefined;
  return Boolean(data && typeof data.boardId === "string" && (data.folderId === null || typeof data.folderId === "string"));
}

function isFolderDropData(value: unknown): value is FolderDropData {
  const data = value as FolderDropData | null | undefined;
  return Boolean(data && (data.folderId === null || typeof data.folderId === "string"));
}

/**
 * The folder move a finished drag asks for, or null when nothing should change (canceled, dropped
 * outside a folder target, or dropped where the board already is).
 */
export function folderMoveFromDrop(
  source: unknown,
  target: unknown,
  canceled = false,
): { boardId: string; folderId: string | null } | null {
  if (canceled || !isBoardDragData(source) || !isFolderDropData(target)) return null;
  if (source.folderId === target.folderId) return null;
  return { boardId: source.boardId, folderId: target.folderId };
}
