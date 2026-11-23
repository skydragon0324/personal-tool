import { ActionIcon, Button, Menu, SegmentedControl, Tooltip } from "@mantine/core";
import type { ReactNode } from "react";

import type { ViewMode } from "../utils/view-mode";
import { BoardGlyph, boardColorClass } from "../utils/board-icons";
import { BOARD_CONTENT_GUTTER } from "../utils/board-layout";
import {
  BoardViewIcon,
  GearIcon,
  PeopleIcon,
  PlusIcon,
  SlidersIcon,
  TableViewIcon,
  TrendIcon,
} from "./board-ui-icons";
import { MobileSidebarButton } from "./board-workspace";
import { t } from "@/i18n";

interface BoardHeaderProps {
  boardName: string;
  boardColor?: string;
  boardIcon?: string | null;
  timezone?: string;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onQuickAdd: () => void;
  onManageStatuses: () => void;
  onShare: () => void;
  /** Members of a shared board cannot manage statuses. */
  isOwner?: boolean;
  memberCount?: number;
  quickAddDisabled?: boolean;
}

const VIEW_MODE_ITEMS: Array<{ value: ViewMode; label: () => string; icon: ReactNode }> = [
  { value: "board", label: () => t("board.viewBoard"), icon: <BoardViewIcon /> },
  { value: "table", label: () => t("board.viewTable"), icon: <TableViewIcon /> },
  { value: "progress", label: () => t("board.viewProgress"), icon: <TrendIcon /> },
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
  onShare,
  isOwner = true,
  memberCount = 0,
  quickAddDisabled = false,
}: BoardHeaderProps) {
  return (
    <header className="z-30 shrink-0 border-b border-[var(--app-border)] bg-[var(--app-surface)]/90 backdrop-blur-xl">
      <div className={`${BOARD_CONTENT_GUTTER} flex flex-wrap items-center justify-between gap-3 py-3`}>
        <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex min-w-0 items-center gap-3">
            <MobileSidebarButton />
            <span
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white ${boardColorClass(boardColor)}`}
            >
              <BoardGlyph name={boardIcon} size={20} />
            </span>
            <div className="min-w-0">
              {!isOwner ? (
                <p className="text-xs font-medium text-[var(--app-text-muted)]">{t("board.sharedBoard")}</p>
              ) : null}
              <h1 className="truncate font-display text-2xl font-semibold tracking-[-0.02em] text-[var(--app-text)] sm:text-[2rem]">
                {boardName}
              </h1>
            </div>
          </div>
          <div className="hidden lg:block">
            <SegmentedControl
              size="sm"
              value={viewMode}
              onChange={(value) => onViewModeChange(value as ViewMode)}
              data={VIEW_MODE_ITEMS.map((item) => ({
                value: item.value,
                label: (
                  <span className="flex items-center gap-2 px-1">
                    {item.icon}
                    {item.label()}
                  </span>
                ),
              }))}
              aria-label={t("board.viewMode")}
              className="board-view-tabs"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Tooltip label={t("board.createStatusFirst")} disabled={!quickAddDisabled}>
            <span>
              <Button onClick={onQuickAdd} disabled={quickAddDisabled} leftSection={<PlusIcon />}>
                {t("board.quickAdd")}
              </Button>
            </span>
          </Tooltip>
          {isOwner ? (
            <Button variant="default" onClick={onManageStatuses} leftSection={<SlidersIcon />}>
              {t("board.manageStatuses")}
            </Button>
          ) : null}
          <Button variant="default" onClick={onShare} leftSection={<PeopleIcon />}>
            {memberCount > 0 ? t("board.shareWithCount", { count: memberCount + 1 }) : t("board.share")}
          </Button>
          <Menu shadow="md" width={240} position="bottom-end">
            <Menu.Target>
              <ActionIcon variant="default" size="lg" aria-label={t("board.settings")}>
                <GearIcon size={18} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <div className="lg:hidden">
                <Menu.Label>{t("board.viewMode")}</Menu.Label>
                {VIEW_MODE_ITEMS.map((item) => (
                  <Menu.Item
                    key={item.value}
                    onClick={() => onViewModeChange(item.value)}
                    rightSection={viewMode === item.value ? "✓" : null}
                  >
                    {item.label()}
                  </Menu.Item>
                ))}
                <Menu.Divider />
              </div>
              <Menu.Label>{t("board.board")}</Menu.Label>
              <Menu.Item disabled>{t("board.timezone", { zone: timezone ?? "Asia/Seoul" })}</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </div>
      </div>
    </header>
  );
}
