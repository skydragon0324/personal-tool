import { Alert, Button, Loader, Text } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useEffect, useMemo, useState } from "react";

import { activeBoards, useBoards } from "@/features/board/hooks/use-boards";
import { PageHeader } from "@/features/shell/components/page-header";
import { QuickCreateTask } from "@/features/tasks/components/quick-create-task";
import { formatLongDate, todayISO } from "@/lib/dates";
import { notifySuccess } from "@/lib/notify";
import { useOpenTask } from "@/lib/use-open-task";
import { t } from "@/i18n";

import { useCalendarTasks } from "../hooks/use-calendar-tasks";
import { useCalendarView } from "../hooks/use-calendar-view";
import { useRescheduleTask } from "../hooks/use-reschedule-task";
import type { CalendarTask } from "../types";
import { daysInRange, groupByDay, rangeLabel, shiftAnchor, visibleRange } from "../utils/calendar-range";
import { CalendarAgenda } from "./calendar-agenda";
import { CalendarGrid } from "./calendar-grid";
import { CalendarToolbar } from "./calendar-toolbar";
import { RescheduleDialog } from "./reschedule-dialog";

/** Below Mantine's `md` breakpoint a seven-column grid gets too narrow; show the agenda instead. */
export const CALENDAR_COMPACT_QUERY = "(max-width: 61.99em)";

export function CalendarPage() {
  const today = todayISO();
  const [view, setView] = useCalendarView();
  // Measured on the first render so a phone never requests the month grid first.
  const compact = useMediaQuery(CALENDAR_COMPACT_QUERY, undefined, { getInitialValueInEffect: false }) ?? false;
  const [anchor, setAnchor] = useState(today);
  const [boardId, setBoardId] = useState<string | null>(null);
  const [createOn, setCreateOn] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState<{ task: CalendarTask; date: string | null } | null>(null);
  const openTask = useOpenTask();
  const boardsQuery = useBoards(false);
  const boards = useMemo(() => activeBoards(boardsQuery.data), [boardsQuery.data]);

  const range = useMemo(() => visibleRange(view, anchor, compact), [view, anchor, compact]);
  const days = useMemo(() => daysInRange(range), [range]);
  const tasks = useCalendarTasks(range, boardId);
  const byDay = useMemo(() => groupByDay(tasks.data?.items ?? []), [tasks.data]);
  const reschedule = useRescheduleTask();
  const layout = compact || view === "agenda" ? "list" : view;

  useEffect(() => {
    document.title = `${t("shell.calendar")} · ${t("common.appName")}`;
    return () => {
      document.title = t("common.appName");
    };
  }, []);

  // A board filter for a board that was archived or left drops back to all boards.
  useEffect(() => {
    if (boardId && boardsQuery.data && !boards.some((board) => board.id === boardId)) setBoardId(null);
  }, [boardId, boards, boardsQuery.data]);

  function save(task: CalendarTask, dueDate: string) {
    reschedule.mutate(
      { task, dueDate },
      {
        onSuccess: () => notifySuccess(t("calendar.moved", { title: task.title, date: formatLongDate(dueDate) })),
        onSettled: () => setRescheduling(null),
      },
    );
  }

  // A drop moves the task at once.
  function moveByDrop(task: CalendarTask, dueDate: string) {
    save(task, dueDate);
  }

  const newTaskDay = days.includes(today) ? today : range.start;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title={t("shell.calendar")} description={t("workspace.calendarHint")}>
        <CalendarToolbar
          view={view}
          onViewChange={setView}
          label={rangeLabel(view, anchor)}
          onPrevious={() => setAnchor(shiftAnchor(view, anchor, -1))}
          onNext={() => setAnchor(shiftAnchor(view, anchor, 1))}
          onToday={() => setAnchor(today)}
          boards={boards}
          boardId={boardId}
          onBoardChange={setBoardId}
          onNewTask={() => setCreateOn(newTaskDay)}
        />
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto h-full w-full max-w-[1480px] p-4 sm:px-6 lg:px-8">
          {tasks.data?.truncated ? (
            <Alert color="yellow" mb="md" title={t("calendar.truncatedTitle")} data-testid="calendar-truncated">
              {t("calendar.truncatedBody", { count: tasks.data.limit })}
            </Alert>
          ) : null}
          {tasks.isLoading ? (
            <div className="flex justify-center py-16" role="status" aria-label={t("calendar.loading")}>
              <Loader />
            </div>
          ) : tasks.isError ? (
            <div className="py-16 text-center">
              <Text mb="sm">{t("workspace.couldNotLoad")}</Text>
              <Button variant="light" onClick={() => void tasks.refetch()}>
                {t("common.retry")}
              </Button>
            </div>
          ) : layout === "list" ? (
            <CalendarAgenda
              days={days}
              today={today}
              byDay={byDay}
              onOpen={(task) => openTask(task.board_id, task.id)}
              onReschedule={(task) => setRescheduling({ task, date: null })}
              onCreate={setCreateOn}
            />
          ) : (
            <CalendarGrid
              view={layout}
              days={days}
              anchor={anchor}
              today={today}
              byDay={byDay}
              onOpen={(task) => openTask(task.board_id, task.id)}
              onReschedule={(task) => setRescheduling({ task, date: null })}
              onMove={moveByDrop}
              onCreate={setCreateOn}
            />
          )}
        </div>
      </div>

      <QuickCreateTask
        opened={createOn !== null}
        dueDate={createOn ?? today}
        boardId={boardId}
        onClose={() => setCreateOn(null)}
      />
      <RescheduleDialog
        task={rescheduling?.task ?? null}
        initialDate={rescheduling?.date}
        submitting={reschedule.isPending}
        onClose={() => setRescheduling(null)}
        onConfirm={save}
      />
    </div>
  );
}
