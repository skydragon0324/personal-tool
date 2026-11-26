import { Button, Loader, Text } from "@mantine/core";
import { useEffect, useState } from "react";

import type { Note } from "@/features/notepad/types";
import { DashboardGrid } from "@/features/shell/components/dashboard-panel";
import { PageHeader } from "@/features/shell/components/page-header";
import { formatWeekdayDate, todayISO } from "@/lib/dates";
import { notifyApiError } from "@/lib/notify";
import { mondayOf } from "@/features/schedule/utils/schedule-time";
import { useScheduleOccurrence } from "@/features/schedule/hooks/use-schedule-occurrence";

import { useToday } from "../hooks/use-today";
import type { TodayPinnedNote, TodaySchedule, TodayTask } from "../types";
import { loadNote, TodayNoteModal, TodayScheduleEditor, TodayTaskModal } from "./today-editors";
import { TodayNotesSection } from "./today-notes-section";
import { TodaySummaryStrip } from "./today-progress";
import { TodayScheduleSection } from "./today-schedule-section";
import { TodayTasksSection } from "./today-tasks-section";
import { t } from "@/i18n";

export function TodayPage() {
  const date = todayISO();
  const todayQuery = useToday(date);
  const occurrence = useScheduleOccurrence();
  const data = todayQuery.data;

  const [openTask, setOpenTask] = useState<TodayTask | null>(null);
  const [openNote, setOpenNote] = useState<Note | null>(null);
  const [openSchedule, setOpenSchedule] = useState<TodaySchedule | null>(null);

  useEffect(() => {
    document.title = "Dashboard · Task Management";
    return () => {
      document.title = "Task Management";
    };
  }, []);

  async function handleOpenNote(note: TodayPinnedNote) {
    try {
      setOpenNote(await loadNote(note.id));
    } catch (error) {
      notifyApiError(error, t("today.couldNotLoadNote"));
    }
  }

  function handleToggleComplete(entry: TodaySchedule, isCompleted: boolean) {
    occurrence.mutate({ entryId: entry.id, occurrenceDate: date, isCompleted });
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--app-bg)]">
      <PageHeader title={t("shell.dashboard")} description={t("today.intro")}>
        {data ? <TodaySummaryStrip tasks={data.task_progress} schedule={data.schedule_progress} /> : null}
        <Text size="sm" c="dimmed">
          {formatWeekdayDate(date)}
        </Text>
      </PageHeader>
      {/* On desktop the four panels share the screen and each scrolls inside itself. */}
      <div className="min-h-0 flex-1 overflow-y-auto md:overflow-hidden">
        <div className="mx-auto h-full w-full max-w-[1480px] px-4 py-4 sm:px-6 lg:px-8">
          {todayQuery.isLoading ? (
            <div className="flex justify-center py-16">
              <Loader />
            </div>
          ) : null}
          {todayQuery.isError && !todayQuery.isLoading ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <Text>{t("today.couldNotLoad")}</Text>
              <Button variant="light" onClick={() => void todayQuery.refetch()}>
                {t("common.retry")}
              </Button>
            </div>
          ) : null}
          {data ? (
            <DashboardGrid label={t("today.gridLabel")} fill>
              <TodayScheduleSection
                date={data.date}
                schedules={data.schedules}
                togglingId={occurrence.pendingKey}
                onToggleComplete={handleToggleComplete}
                onOpen={setOpenSchedule}
              />
              <TodayTasksSection
                title={t("today.activeTasks")}
                description={t("today.activeTasksHint")}
                emptyText={t("today.noActiveTasks")}
                emptyActionHref="/boards"
                emptyActionLabel={t("today.openBoards")}
                icon="boards"
                tasks={data.active_tasks}
                onOpen={setOpenTask}
              />
              <TodayTasksSection
                title={t("today.needsAttention")}
                description={t("today.needsAttentionHint")}
                emptyText={t("today.allCaughtUp")}
                icon="today"
                tasks={data.overdue_tasks}
                onOpen={setOpenTask}
              />
              <TodayNotesSection
                notes={data.pinned_notes}
                total={data.pinned_notes_total}
                onOpen={(note) => void handleOpenNote(note)}
              />
            </DashboardGrid>
          ) : null}
        </div>
      </div>
      <TodayTaskModal
        taskId={openTask?.id ?? null}
        boardId={openTask?.board_id ?? null}
        onClose={() => setOpenTask(null)}
      />
      <TodayNoteModal note={openNote} onClose={() => setOpenNote(null)} />
      <TodayScheduleEditor
        entry={openSchedule}
        weekStart={mondayOf(date)}
        selectedDate={date}
        onClose={() => setOpenSchedule(null)}
      />
    </div>
  );
}
