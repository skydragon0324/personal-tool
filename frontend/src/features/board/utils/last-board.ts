export const LAST_BOARD_STORAGE_KEY = "life-management:last-board-id";

export function readLastBoardId(storage?: Pick<Storage, "getItem"> | null): string | null {
  if (!storage) return null;
  return storage.getItem(LAST_BOARD_STORAGE_KEY);
}

export function writeLastBoardId(boardId: string, storage?: Pick<Storage, "setItem"> | null): void {
  storage?.setItem(LAST_BOARD_STORAGE_KEY, boardId);
}

export function resolveLastBoardId(
  boards: Array<{ id: string; archived_at: string | null; position: number }>,
  storedId: string | null,
): string | null {
  const active = [...boards]
    .filter((board) => !board.archived_at)
    .sort((a, b) => a.position - b.position);
  if (!active.length) return null;
  if (storedId && active.some((board) => board.id === storedId)) return storedId;
  return active[0].id;
}
