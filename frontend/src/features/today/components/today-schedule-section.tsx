"use client";

import { Button, Checkbox, Text } from "@mantine/core";
import Link from "next/link";

import { statusHeaderClass } from "@/features/board/utils/status-colors";
import { PriorityBadge } from "@/features/tasks/components/priority-badge";
import { formatTimeLabel } from "@/features/schedule/utils/schedule-time";

import type { TodaySchedule } from "../types";
import { SCHEDULE_KIND_LABEL } from "../utils/labels";
import { SCHEDULE_STATUS_LABEL, scheduleTimeStatus } from "../utils/schedule-status";

const STATUS_CLASS: Record<string, string> = {
  upcoming: "bg-slate-100 text-slate-800 dark:bg-slate-500/25 dark:text-slate-100",
  in_progress: "bg-sky-100 text-sky-900 dark:bg-sky-500/20 dark:text-sky-100",
  passed: "bg-orange-100 text-orange-900 dark:bg-orange-500/20 dark:text-orange-100",
  completed: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-100",
};

export function TodayScheduleSection({
  date,
  schedules,
  togglingId,
  onToggleComplete,
  onOpen,
}: {
  date: string;
  schedules: TodaySchedule[];
  togglingId?: string | null;
  onToggleComplete: (entry: TodaySchedule, isCompleted: boolean) => void;
  onOpen: (entry: TodaySchedule) => void;
}) {
  return (
    <section aria-label="Today's schedule" className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
      <h2 className="font-display text-xl text-[var(--app-text)]">Today&apos;s schedule</h2>
      {schedules.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <Text c="dimmed" maw={420}>
            Nothing scheduled for today.
          </Text>
          <Button component={Link} href="/schedule">
            Open schedule
          </Button>
        </div>
      ) : (
        <ol className="mt-4 space-y-2">
          {schedules.map((entry) => {
            const status = scheduleTimeStatus({
              date,
              startTime: entry.start_time,
              endTime: entry.end_time,
              isCompleted: entry.is_completed,
            });
            return (
              <li key={entry.id}>
                <div
                  className={`flex items-start gap-3 rounded-lg px-2 py-2 ${
                    entry.is_completed ? "opacity-55" : ""
                  }`}
                >
                  <span
                    className={`mt-1 h-10 w-1.5 shrink-0 rounded-full ${statusHeaderClass(entry.color)}`}
                    aria-hidden
                  />
                  <Checkbox
                    checked={entry.is_completed}
                    disabled={togglingId === entry.id}
                    aria-label={
                      entry.is_completed
                        ? `Mark ${entry.title} incomplete`
                        : `Mark ${entry.title} complete`
                    }
                    onChange={(event) => onToggleComplete(entry, event.currentTarget.checked)}
                    onClick={(event) => event.stopPropagation()}
                  />
                  <button
                    type="button"
                    onClick={() => onOpen(entry)}
                    className="min-w-0 flex-1 rounded-md text-left hover:bg-[var(--app-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--app-primary)]"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium text-[var(--app-text)]">{entry.title}</p>
                      <span className="rounded-full bg-[var(--app-surface-muted)] px-2 py-0.5 text-xs font-medium text-[var(--app-text-muted)]">
                        {SCHEDULE_KIND_LABEL[entry.kind]}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[status]}`}>
                        {SCHEDULE_STATUS_LABEL[status]}
                      </span>
                      {entry.priority ? <PriorityBadge priority={entry.priority} /> : null}
                    </div>
                    <p className="mt-1 text-xs text-[var(--app-text-muted)]">
                      {formatTimeLabel(entry.start_time)} – {formatTimeLabel(entry.end_time)}
                    </p>
                    {entry.notes ? (
                      <p className="mt-1 line-clamp-2 text-sm text-[var(--app-text-muted)]">{entry.notes}</p>
                    ) : null}
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
