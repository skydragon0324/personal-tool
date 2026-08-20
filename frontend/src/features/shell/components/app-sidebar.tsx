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
import { boardIdFromPath, sectionFromPath } from "../utils/navigation";
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

  function handleBoardsClick() {
    setCollapsed(false);
    chrome?.closeSidebar();
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
          Today
        </Link>
        <div className="mt-1 flex items-center gap-1">
          <Link
            href="/boards"
            aria-current={pathname === "/boards" ? "page" : undefined}
            onClick={handleBoardsClick}
            className={`flex-1 ${navItemClass(pathname === "/boards")}`}
          >
            Boards
          </Link>
          <button
            type="button"
            aria-label={expanded ? "Collapse boards" : "Expand boards"}
            aria-expanded={expanded}
            onClick={() => setCollapsed(expanded)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--app-primary)]"
          >
            <ChevronIcon expanded={expanded} />
          </button>
        </div>
        {ready && expanded ? (
          <BoardList
            boards={boards}
            currentBoardId={currentBoardId}
            onNavigate={() => chrome?.closeSidebar()}
            onNewBoard={() => chrome?.openNewBoard()}
            onManageBoards={() => chrome?.openManageBoards()}
          />
        ) : null}
        <Link
          href="/notepad"
          aria-current={section === "notepad" ? "page" : undefined}
          onClick={() => chrome?.closeSidebar()}
          className={`mt-1 shrink-0 ${navItemClass(section === "notepad")}`}
        >
          Notepad
        </Link>
        <Link
          href="/schedule"
          aria-current={section === "schedule" ? "page" : undefined}
          onClick={() => chrome?.closeSidebar()}
          className={`mt-1 shrink-0 ${navItemClass(section === "schedule")}`}
        >
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
  onNewBoard,
  onManageBoards,
}: {
  boards: Array<{
    id: string;
    name: string;
    color: string;
    icon_name: string | null;
  }>;
  currentBoardId?: string;
  onNavigate: () => void;
  onNewBoard: () => void;
  onManageBoards: () => void;
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
    <div className="mt-1 flex min-h-0 flex-1 flex-col">
      <ScrollArea className="min-h-0 flex-1" type="auto" viewportRef={viewportRef}>
        <div className="flex flex-col gap-1 py-1">
          {boards.map((board) => {
            const current = board.id === currentBoardId;
            return (
              <Link
                key={board.id}
                href={`/boards/${board.id}`}
                ref={current ? currentRef : undefined}
                onClick={onNavigate}
                aria-current={current ? "page" : undefined}
                className={`flex items-center gap-2 rounded-r-lg py-2 pr-2 text-sm font-medium ${
                  current
                    ? "border-l-[3px] border-[var(--app-primary)] bg-[var(--app-primary)]/18 pl-[5px] text-[var(--app-text)]"
                    : "border-l-[3px] border-transparent pl-[5px] text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)]"
                }`}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-md text-white ${boardColorClass(board.color)} ${
                    current
                      ? "ring-2 ring-[var(--app-primary)] ring-offset-2 ring-offset-[var(--app-surface)]"
                      : ""
                  }`}
                >
                  <BoardGlyph name={board.icon_name} size={14} />
                </span>
                <span className="min-w-0 flex-1 truncate">{board.name}</span>
              </Link>
            );
          })}
          {!boards.length ? (
            <Text size="sm" c="dimmed" px="xs">
              No boards yet
            </Text>
          ) : null}
        </div>
      </ScrollArea>
      <div className="flex flex-col gap-2 px-1 py-2">
        <Button onClick={onNewBoard}>New board</Button>
        <Button variant="light" onClick={onManageBoards}>
          Manage boards
        </Button>
      </div>
    </div>
  );
}

function navItemClass(active: boolean): string {
  return `flex min-w-0 items-center rounded-md px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--app-primary)] ${
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
