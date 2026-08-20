export const BOARDS_NAV_COLLAPSED_KEY = "life-management:boards-nav-collapsed";

export function readBoardsNavCollapsed(storage?: Pick<Storage, "getItem"> | null): boolean | null {
  if (!storage) return null;
  const value = storage.getItem(BOARDS_NAV_COLLAPSED_KEY);
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

export function writeBoardsNavCollapsed(
  collapsed: boolean,
  storage?: Pick<Storage, "setItem"> | null,
): void {
  storage?.setItem(BOARDS_NAV_COLLAPSED_KEY, collapsed ? "true" : "false");
}

export function boardsGroupExpanded(pathname: string | null, storedCollapsed: boolean | null): boolean {
  if (storedCollapsed === true) return false;
  if (storedCollapsed === false) return true;
  return pathname === "/boards" || Boolean(pathname?.startsWith("/boards/"));
}
