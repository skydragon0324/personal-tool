"use client";

import { Button, Loader, Text } from "@mantine/core";
import { useEffect, useState } from "react";

import { useAuth } from "@/features/auth/components/auth-provider";
import type { Note } from "@/features/notepad/types";
import { DashboardGrid } from "@/features/shell/components/dashboard-panel";
import { PageHeader } from "@/features/shell/components/page-header";
import { formatWeekdayDate, greetingForName, todayISO } from "@/lib/dates";
import { notifyApiError } from "@/lib/notify";
import { mondayOf } from "@/features/schedule/utils/schedule-time";

import { useScheduleOccurrence, useToday } from "../hooks/use-today";
import type { TodayPinnedNote, TodaySchedule, TodayTask } from "../types";
import { loadNote, TodayNoteDrawer, TodayScheduleEditor, TodayTaskDrawer } from "./today-editors";
import { TodayNotesSection } from "./today-notes-section";
import { TodaySummaryStrip } from "./today-progress";
import { TodayScheduleSection } from "./today-schedule-section";
import { TodayTasksSection } from "./today-tasks-section";

export function TodayPage() {
  const date = todayISO();
  const { user } = useAuth();
  const todayQuery = useToday(date);
  const occurrence = useScheduleOccurrence();
  const data = todayQuery.data;

  const [openTask, setOpenTask] = useState<TodayTask | null>(null);
  const [openNote, setOpenNote] = useState<Note | null>(null);
  const [openSchedule, setOpenSchedule] = useState<TodaySchedule | null>(null);

  useEffect(() => {
    document.title = "Today · Life Management";
    return () => {
      document.title = "Life Management";
    };
  }, []);

  async function handleOpenNote(note: TodayPinnedNote) {
    try {
      setOpenNote(await loadNote(note.id));
    } catch (error) {
      notifyApiError(error, "Could not load note");
    }
  }

  function handleToggleComplete(entry: TodaySchedule, isCompleted: boolean) {
    occurrence.mutate(
      { entryId: entry.id, occurrenceDate: date, isCompleted },
      {
        onError: (error) => notifyApiError(error, "Could not update schedule"),
      },
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--app-bg)]">
      <PageHeader title="Today">
        <Text size="sm" c="dimmed">
          {formatWeekdayDate(date)}
        </Text>
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-[1400px] space-y-4 px-4 py-5 sm:px-6">
          <p className="text-sm text-[var(--app-text-muted)]">
            Your tasks, schedule, and pinned notes for today.
          </p>
          {todayQuery.isLoading ? (
            <div className="flex justify-center py-16">
              <Loader />
            </div>
          ) : null}
          {todayQuery.isError && !todayQuery.isLoading ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <Text>Could not load today.</Text>
              <Button variant="light" onClick={() => void todayQuery.refetch()}>
                Retry
              </Button>
            </div>
          ) : null}
          {data ? (
            <>
              <TodaySummaryStrip
                greeting={greetingForName(user?.display_name ?? "")}
                dateLabel={formatWeekdayDate(date)}
                tasks={data.task_progress}
                schedule={data.schedule_progress}
              />
              <DashboardGrid label="Today dashboard">
                <TodayScheduleSection
                  date={data.date}
                  schedules={data.schedules}
                  togglingId={occurrence.isPending ? occurrence.variables?.entryId : null}
                  onToggleComplete={handleToggleComplete}
                  onOpen={setOpenSchedule}
                />
                <TodayTasksSection
                  title="Active tasks"
                  description="Tasks whose active period includes today"
                  emptyText="No tasks are scheduled for today."
                  emptyActionHref="/boards"
                  emptyActionLabel="Open boards"
                  icon="boards"
                  tasks={data.active_tasks}
                  onOpen={setOpenTask}
                />
                <TodayTasksSection
                  title="Needs attention"
                  description="Unfinished tasks past their due date"
                  emptyText="You're all caught up."
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
            </>
          ) : null}
        </div>
      </div>
      <TodayTaskDrawer
        taskId={openTask?.id ?? null}
        boardId={openTask?.board_id ?? null}
        onClose={() => setOpenTask(null)}
      />
      <TodayNoteDrawer note={openNote} onClose={() => setOpenNote(null)} />
      <TodayScheduleEditor
        entry={openSchedule}
        weekStart={mondayOf(date)}
        selectedDate={date}
        onClose={() => setOpenSchedule(null)}
      />
    </div>
  );
}
