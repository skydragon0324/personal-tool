import { useDraggable } from "@dnd-kit/react";
import { ActionIcon } from "@mantine/core";
import { useMemo } from "react";

import { CalendarIcon } from "@/features/board/components/board-ui-icons";
import { boardColorClass } from "@/features/board/utils/board-icons";
import { PriorityBadge } from "@/features/tasks/components/priority-badge";
import { t } from "@/i18n";

import type { CalendarTask } from "../types";
import { CALENDAR_TASK_DRAG_TYPE, type CalendarDragData } from "../utils/calendar-dnd";

interface TaskItemProps {
  task: CalendarTask;
  onOpen: (task: CalendarTask) => void;
  /** Opens the date dialog: the keyboard and touch way to reschedule. */
  onReschedule: (task: CalendarTask) => void;
}

/** Done state as text and a symbol, so it does not rely on color. */
function TaskState({ task }: { task: CalendarTask }) {
  if (!task.is_done) return null;
  return (
    <>
      <span aria-hidden className="shrink-0 text-[var(--app-text-muted)]">
        ✓
      </span>
      <span className="sr-only">{t("calendar.completed")}</span>
    </>
  );
}

function RescheduleButton({ task, onReschedule, className = "" }: Pick<TaskItemProps, "task" | "onReschedule"> & { className?: string }) {
  return (
    <ActionIcon
      variant="subtle"
      color="gray"
      size="sm"
      aria-label={t("calendar.changeDateOf", { title: task.title })}
      title={t("calendar.changeDate")}
      onClick={() => onReschedule(task)}
      className={className}
    >
      <CalendarIcon size={14} />
    </ActionIcon>
  );
}

/** A task in a month or week cell. Drag it onto another day to move its due date. */
export function CalendarTaskChip({ task, onOpen, onReschedule }: TaskItemProps) {
  const data = useMemo<CalendarDragData>(() => ({ task }), [task]);
  const { ref, isDragging } = useDraggable({ id: `calendar-task:${task.id}`, type: CALENDAR_TASK_DRAG_TYPE, data });
  return (
    <div
      data-calendar-task={task.id}
      className={`calendar-chip flex shrink-0 items-center rounded-md bg-[var(--app-surface-muted)] hover:bg-[var(--app-primary-soft)] ${
        isDragging ? "opacity-60" : ""
      }`}
    >
      <button
        ref={ref}
        type="button"
        title={`${task.title} · ${task.board_name}`}
        onClick={() => onOpen(task)}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left text-xs text-[var(--app-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--app-primary)]"
      >
        <span aria-hidden className={`h-2 w-2 shrink-0 rounded-sm ${boardColorClass(task.board_color)}`} />
        <TaskState task={task} />
        <span className={`truncate ${task.is_done ? "text-[var(--app-text-muted)] line-through" : ""}`}>{task.title}</span>
        <span className="sr-only">{`· ${task.board_name}`}</span>
      </button>
      <RescheduleButton
        task={task}
        onReschedule={onReschedule}
        className="calendar-chip-action shrink-0"
      />
    </div>
  );
}

/** A task in the agenda list: full title, board, status and priority, plus a reschedule button. */
export function CalendarAgendaItem({ task, onOpen, onReschedule }: TaskItemProps) {
  return (
    <li
      data-calendar-task={task.id}
      className="flex items-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2"
    >
      <button
        type="button"
        onClick={() => onOpen(task)}
        className="flex min-w-0 flex-1 flex-col items-start gap-0.5 rounded-md text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--app-primary)]"
      >
        <span className="flex w-full min-w-0 items-center gap-1.5 text-sm text-[var(--app-text)]">
          <TaskState task={task} />
          <span className={`truncate font-medium ${task.is_done ? "text-[var(--app-text-muted)] line-through" : ""}`}>
            {task.title}
          </span>
        </span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--app-text-muted)]">
          <span className="inline-flex min-w-0 items-center gap-1">
            <span aria-hidden className={`h-2 w-2 shrink-0 rounded-sm ${boardColorClass(task.board_color)}`} />
            <span className="truncate">{task.board_name}</span>
          </span>
          <span>{task.status_name}</span>
          <PriorityBadge priority={task.priority} />
        </span>
      </button>
      <RescheduleButton task={task} onReschedule={onReschedule} />
    </li>
  );
}
