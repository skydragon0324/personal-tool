export type AppSection = "today" | "boards" | "notepad" | "schedule";

export function isBoardsPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === "/boards" || pathname.startsWith("/boards/");
}

export function isBoardDetailPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname.startsWith("/boards/") && pathname !== "/boards";
}

export function sectionFromPath(pathname: string | null): AppSection {
  if (pathname === "/today" || pathname?.startsWith("/today/")) return "today";
  if (pathname === "/inbox" || pathname?.startsWith("/inbox/")) return "today";
  if (pathname === "/notepad" || pathname?.startsWith("/notepad/")) return "notepad";
  if (pathname === "/schedule" || pathname?.startsWith("/schedule/")) return "schedule";
  return "boards";
}

export function boardIdFromPath(pathname: string | null): string | undefined {
  if (!pathname) return undefined;
  const match = pathname.match(/^\/boards\/([^/]+)$/);
  return match?.[1];
}
