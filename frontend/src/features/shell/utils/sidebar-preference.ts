/**
 * Whether the large-screen sidebar is collapsed to its icon rail. Kept apart from the Boards
 * section's own preference (`boards-nav.ts`) so collapsing one never changes the other.
 */
export const SIDEBAR_COLLAPSED_KEY = "life-management:sidebar-collapsed";

/** Expanded sidebar width; the collapsed rail width. */
export const SIDEBAR_WIDTH = 272;
export const SIDEBAR_RAIL_WIDTH = 60;

/** Id of the element the sidebar toggles control (the desktop sidebar or the mobile drawer). */
export const SIDEBAR_ID = "app-sidebar";

export function readSidebarCollapsed(storage?: Pick<Storage, "getItem"> | null): boolean {
  try {
    return storage?.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

export function writeSidebarCollapsed(collapsed: boolean, storage?: Pick<Storage, "setItem"> | null): void {
  try {
    storage?.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "true" : "false");
  } catch {
    // Storage can be blocked or full; the sidebar still toggles for this visit.
  }
}

/** Compact counter text for the rail: "9", "99", then "99+". */
export function compactCount(count: number): string {
  return count > 99 ? "99+" : String(count);
}
