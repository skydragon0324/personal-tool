export type AppSection = "today" | "boards" | "notepad" | "schedule";

const BOARD_STATIC_SEGMENTS = new Set(["recurring"]);

export function isBoardsPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === "/boards" || pathname.startsWith("/boards/");
}

export function isBoardDetailPath(pathname: string | null): boolean {
  if (!pathname) return false;
  const match = pathname.match(/^\/boards\/([^/]+)$/);
  if (!match) return false;
  return !BOARD_STATIC_SEGMENTS.has(match[1]);
}

export function isBoardsIndexPath(pathname: string | null): boolean {
  return pathname === "/boards" || pathname === "/boards/recurring";
}

export function sectionFromPath(pathname: string | null): AppSection {
  if (pathname === "/today" || pathname?.startsWith("/today/")) return "today";
  if (pathname === "/inbox" || pathname?.startsWith("/inbox/")) return "today";
  if (pathname === "/notepad" || pathname?.startsWith("/notepad/")) return "notepad";
  if (pathname === "/schedule" || pathname?.startsWith("/schedule/")) return "schedule";
  return "boards";
}

export function boardIdFromPath(pathname: string | null): string | undefined {
  if (!isBoardDetailPath(pathname) || !pathname) return undefined;
  return pathname.match(/^\/boards\/([^/]+)$/)?.[1];
}
