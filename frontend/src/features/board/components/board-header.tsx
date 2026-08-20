"use client";

import { Button, Menu, Tooltip } from "@mantine/core";

import type { ViewMode } from "../utils/view-mode";
import { BoardGlyph, boardColorClass } from "../utils/board-icons";
import { MobileSidebarButton } from "./board-workspace";

interface BoardHeaderProps {
  boardName: string;
  boardColor?: string;
  boardIcon?: string | null;
  timezone?: string;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onQuickAdd: () => void;
  onManageStatuses: () => void;
  quickAddDisabled?: boolean;
}

const VIEW_MODE_ITEMS: Array<{ value: ViewMode; label: string }> = [
  { value: "board", label: "Board" },
  { value: "table", label: "Table" },
  { value: "progress", label: "Progress" },
];

export function BoardHeader({
  boardName,
  boardColor = "teal",
  boardIcon,
  timezone,
  viewMode,
  onViewModeChange,
  onQuickAdd,
  onManageStatuses,
  quickAddDisabled = false,
}: BoardHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--app-border)] bg-[var(--app-surface)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <MobileSidebarButton />
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ${boardColorClass(boardColor)}`}
          >
            <BoardGlyph name={boardIcon} size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--app-text-muted)]">
              Current board
            </p>
            <h1 className="truncate font-display text-2xl text-[var(--app-text)] sm:text-3xl">
              {boardName}
            </h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tooltip label="Create a status first" disabled={!quickAddDisabled}>
            <span>
              <Button onClick={onQuickAdd} disabled={quickAddDisabled}>
                Quick add
              </Button>
            </span>
          </Tooltip>
          <Button variant="light" onClick={onManageStatuses}>
            Manage statuses
          </Button>
          <Menu shadow="md" width={220} position="bottom-end">
            <Menu.Target>
              <Button variant="default">Settings</Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>View mode</Menu.Label>
              {VIEW_MODE_ITEMS.map((item) => (
                <Menu.Item
                  key={item.value}
                  onClick={() => onViewModeChange(item.value)}
                  rightSection={viewMode === item.value ? "✓" : null}
                >
                  {item.label}
                </Menu.Item>
              ))}
              <Menu.Divider />
              <Menu.Label>Board</Menu.Label>
              <Menu.Item disabled>Timezone: {timezone ?? "Asia/Seoul"}</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </div>
      </div>
    </header>
  );
}
