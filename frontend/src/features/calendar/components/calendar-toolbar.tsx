import { ActionIcon, Button, SegmentedControl, Select } from "@mantine/core";

import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "@/features/board/components/board-ui-icons";
import type { BoardListItem } from "@/features/board/types";
import { t } from "@/i18n";

import type { CalendarView } from "../types";

interface CalendarToolbarProps {
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  label: string;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  boards: BoardListItem[];
  boardId: string | null;
  onBoardChange: (boardId: string | null) => void;
  onNewTask: () => void;
}

export function CalendarToolbar({
  view,
  onViewChange,
  label,
  onPrevious,
  onNext,
  onToday,
  boards,
  boardId,
  onBoardChange,
  onNewTask,
}: CalendarToolbarProps) {
  const isWeek = view === "week";
  return (
    <>
      <SegmentedControl
        aria-label={t("calendar.viewLabel")}
        value={view}
        onChange={(value) => onViewChange(value as CalendarView)}
        data={[
          { value: "month", label: t("calendar.month") },
          { value: "week", label: t("calendar.week") },
          { value: "agenda", label: t("calendar.agenda") },
        ]}
      />
      <Select
        aria-label={t("calendar.boardFilter")}
        placeholder={t("calendar.allBoards")}
        data={boards.map((board) => ({ value: board.id, label: board.name }))}
        value={boardId}
        onChange={onBoardChange}
        clearable
        searchable
        w={180}
      />
      <Button variant="default" onClick={onToday}>
        {t("calendar.today")}
      </Button>
      <div className="flex items-center gap-1">
        <ActionIcon
          variant="default"
          size="lg"
          aria-label={isWeek ? t("calendar.previousWeek") : t("workspace.previousMonth")}
          onClick={onPrevious}
        >
          <ChevronLeftIcon />
        </ActionIcon>
        <span className="min-w-[10rem] text-center font-semibold text-[var(--app-text)]" aria-live="polite">
          {label}
        </span>
        <ActionIcon
          variant="default"
          size="lg"
          aria-label={isWeek ? t("calendar.nextWeek") : t("workspace.nextMonth")}
          onClick={onNext}
        >
          <ChevronRightIcon />
        </ActionIcon>
      </div>
      <Button leftSection={<PlusIcon size={16} />} onClick={onNewTask}>
        {t("calendar.newTask")}
      </Button>
    </>
  );
}
