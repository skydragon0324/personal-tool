"use client";

import { Button, Text } from "@mantine/core";
import Link from "next/link";

import { BoardGlyph, boardColorClass } from "@/features/board/utils/board-icons";
import { statusHeaderClass } from "@/features/board/utils/status-colors";
import { PriorityBadge } from "@/features/tasks/components/priority-badge";
import { formatTaskPeriod } from "@/lib/dates";

import type { TodayTask } from "../types";
import { DEADLINE_STATUS_LABEL } from "../utils/labels";

export function TodayTasksSection({
  tasks,
  onOpen,
}: {
  tasks: TodayTask[];
  onOpen: (task: TodayTask) => void;
}) {
  return (
    <section aria-label="Active tasks" className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
      <h2 className="font-display text-xl text-[var(--app-text)]">Active tasks</h2>
      {tasks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <Text c="dimmed" maw={420}>
            No tasks are scheduled for today.
          </Text>
          <Button component={Link} href="/boards">
            Open boards
          </Button>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {tasks.map((task) => {
            const completed = Boolean(task.completed_at) || task.status_is_done;
            return (
              <li key={task.id}>
                <button
                  type="button"
                  onClick={() => onOpen(task)}
                  className={`flex w-full items-start gap-3 rounded-lg border border-[var(--app-border)] px-3 py-3 text-left hover:border-[var(--app-primary)]/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--app-primary)] ${
                    completed ? "opacity-55" : ""
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white ${boardColorClass(task.board_color)}`}
                    title={task.board_name}
                  >
                    <BoardGlyph name={task.board_icon_name} size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-[var(--app-text)]">{task.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--app-text-muted)]">
                      <span>{task.board_name}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 font-medium text-white ${statusHeaderClass(task.status_color)}`}
                      >
                        {task.status_name}
                      </span>
                      <PriorityBadge priority={task.priority} />
                      <span>{DEADLINE_STATUS_LABEL[task.deadline_status]}</span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--app-text-muted)]">
                      {formatTaskPeriod(task.start_date, task.due_date)}
                    </p>
                    {task.subtask_total > 0 ? (
                      <p className="mt-1 text-xs text-[var(--app-text-muted)]">
                        Subtasks {task.subtask_completed}/{task.subtask_total}
                      </p>
                    ) : null}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
