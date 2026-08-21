"use client";

import { Button, ScrollArea, Text } from "@mantine/core";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/features/auth/components/auth-provider";
import { ThemeToggle } from "@/features/board/components/theme-toggle";
import { useBoards, activeBoards } from "@/features/board/hooks/use-boards";
import { BoardGlyph, boardColorClass } from "@/features/board/utils/board-icons";

import { boardsGroupExpanded, readBoardsNavCollapsed, writeBoardsNavCollapsed } from "../utils/boards-nav";
import { boardIdFromPath, isBoardsIndexPath, sectionFromPath } from "../utils/navigation";
import { NavIcon } from "./nav-icons";
import { useWorkspaceChrome } from "./workspace-chrome";

let savedBoardListScrollTop = 0;

export function AppSidebar() {
  const pathname = usePathname();
  const chrome = useWorkspaceChrome();
  const { user, logout } = useAuth();
  const boardsQuery = useBoards(true);
  const boards = activeBoards(boardsQuery.data);
  const currentBoardId = boardIdFromPath(pathname);
  const section = sectionFromPath(pathname);
  const boardsParentActive = isBoardsIndexPath(pathname);
  const [storedCollapsed, setStoredCollapsed] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setStoredCollapsed(readBoardsNavCollapsed(window.localStorage));
    setReady(true);
  }, []);

  const expanded = boardsGroupExpanded(pathname, storedCollapsed);

  function setCollapsed(next: boolean) {
    setStoredCollapsed(next);
    writeBoardsNavCollapsed(next, window.localStorage);
  }

  return (
    <div className="flex h-full flex-col bg-[var(--app-surface)]">
      <div className="border-b border-[var(--app-border)] px-4 py-4">
        <p className="font-display text-lg text-[var(--app-text)]">Life Management</p>
      </div>
      <nav aria-label="Application" className="flex min-h-0 flex-1 flex-col px-2 py-3">
        <Link
          href="/today"
          aria-current={section === "today" ? "page" : undefined}
          onClick={() => chrome?.closeSidebar()}
          className={`shrink-0 ${navItemClass(section === "today")}`}
        >
          <NavIcon name="today" />
          Today
        </Link>
        <div className="mt-1 flex items-center gap-1">
          <Link
            href="/boards"
            aria-current={boardsParentActive ? "page" : undefined}
            onClick={() => {
              setCollapsed(false);
              chrome?.closeSidebar();
            }}
            className={`flex-1 ${navItemClass(boardsParentActive)}`}
          >
            <NavIcon name="boards" />
            Boards
          </Link>
          <button
            type="button"
            aria-label={expanded ? "Collapse boards" : "Expand boards"}
            aria-expanded={expanded}
            onClick={() => setCollapsed(expanded)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--app-primary)]"
          >
            <ChevronIcon expanded={expanded} />
          </button>
        </div>
        {ready && expanded ? (
          <BoardList
            boards={boards}
            currentBoardId={currentBoardId}
            onNavigate={() => chrome?.closeSidebar()}
          />
        ) : null}
        <Link
          href="/notepad"
          aria-current={section === "notepad" ? "page" : undefined}
          onClick={() => chrome?.closeSidebar()}
          className={`mt-1 shrink-0 ${navItemClass(section === "notepad")}`}
        >
          <NavIcon name="notepad" />
          Notepad
        </Link>
        <Link
          href="/schedule"
          aria-current={section === "schedule" ? "page" : undefined}
          onClick={() => chrome?.closeSidebar()}
          className={`mt-1 shrink-0 ${navItemClass(section === "schedule")}`}
        >
          <NavIcon name="schedule" />
          Schedule
        </Link>
      </nav>
      <div className="border-t border-[var(--app-border)] px-3 py-3">
        {user ? (
          <div className="mb-3 px-1">
            <p className="truncate text-sm font-medium text-[var(--app-text)]">{user.display_name}</p>
            <p className="truncate text-xs text-[var(--app-text-muted)]">{user.email}</p>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-2">
          <Button variant="subtle" color="gray" onClick={() => void logout()}>
            Logout
          </Button>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}

function BoardList({
  boards,
  currentBoardId,
  onNavigate,
}: {
  boards: Array<{
    id: string;
    name: string;
    color: string;
    icon_name: string | null;
  }>;
  currentBoardId?: string;
  onNavigate: () => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollTop = savedBoardListScrollTop;
    const onScroll = () => {
      savedBoardListScrollTop = viewport.scrollTop;
    };
    viewport.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (viewport.scrollTop) savedBoardListScrollTop = viewport.scrollTop;
      viewport.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    const item = currentRef.current;
    const viewport = viewportRef.current;
    if (!item || !viewport) return;
    const itemRect = item.getBoundingClientRect();
    const viewRect = viewport.getBoundingClientRect();
    const offScreen = itemRect.top < viewRect.top || itemRect.bottom > viewRect.bottom;
    if (offScreen) item.scrollIntoView({ block: "nearest" });
  }, [currentBoardId]);

  return (
    <div
      aria-label="Your boards"
      className="mt-1 ml-3 max-h-[min(40vh,320px)] min-h-0 shrink-0 overflow-hidden border-l border-[var(--app-border)] pl-3"
    >
      <ScrollArea className="h-full max-h-[min(40vh,320px)]" type="auto" viewportRef={viewportRef}>
        <div className="flex flex-col gap-0.5 py-1">
          {boards.map((board) => {
            const current = board.id === currentBoardId;
            return (
              <Link
                key={board.id}
                href={`/boards/${board.id}`}
                ref={current ? currentRef : undefined}
                onClick={onNavigate}
                aria-current={current ? "page" : undefined}
                className={`flex items-center gap-2 rounded-md py-1.5 pr-2 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--app-primary)] ${
                  current
                    ? "border-l-2 border-[var(--app-primary)] bg-[var(--app-primary)]/12 pl-1.5 text-[var(--app-text)]"
                    : "border-l-2 border-transparent pl-1.5 text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)]"
                }`}
              >
                <span
                  className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md text-white ${boardColorClass(board.color)}`}
                >
                  <BoardGlyph name={board.icon_name} size={12} />
                </span>
                <span className="min-w-0 flex-1 truncate">{board.name}</span>
              </Link>
            );
          })}
          {!boards.length ? (
            <Text size="xs" c="dimmed" px="xs">
              No boards yet
            </Text>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}

function navItemClass(active: boolean): string {
  return `flex min-w-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--app-primary)] ${
    active
      ? "bg-[var(--app-primary)]/15 text-[var(--app-text)]"
      : "text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)]"
  }`;
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={`transition-transform ${expanded ? "rotate-90" : ""}`}
    >
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
