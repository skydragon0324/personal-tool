import { Button, Menu, Tooltip } from "@mantine/core";

import type { ViewMode } from "../utils/view-mode";
import { BoardGlyph, boardColorClass } from "../utils/board-icons";
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

const VIEW_MODE_ITEMS: Array<{ value: ViewMode; label: () => string }> = [
  { value: "board", label: () => t("board.viewBoard") },
  { value: "table", label: () => t("board.viewTable") },
  { value: "progress", label: () => t("board.viewProgress") },
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
              {isOwner ? t("board.currentBoard") : t("board.sharedBoard")}
            </p>
            <h1 className="truncate font-display text-2xl text-[var(--app-text)] sm:text-3xl">
              {boardName}
            </h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tooltip label={t("board.createStatusFirst")} disabled={!quickAddDisabled}>
            <span>
              <Button onClick={onQuickAdd} disabled={quickAddDisabled}>
                {t("board.quickAdd")}
              </Button>
            </span>
          </Tooltip>
          {isOwner ? (
            <Button variant="light" onClick={onManageStatuses}>
              {t("board.manageStatuses")}
            </Button>
          ) : null}
          <Button variant="default" onClick={onShare}>
            {memberCount > 0 ? t("board.shareWithCount", { count: memberCount + 1 }) : t("board.share")}
          </Button>
          <Menu shadow="md" width={220} position="bottom-end">
            <Menu.Target>
              <Button variant="default">{t("board.settings")}</Button>
            </Menu.Target>
            <Menu.Dropdown>
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
              <Menu.Label>{t("board.board")}</Menu.Label>
              <Menu.Item disabled>{t("board.timezone", { zone: timezone ?? "Asia/Seoul" })}</Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </div>
      </div>
    </header>
  );
}
