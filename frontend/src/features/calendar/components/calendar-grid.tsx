import { PointerActivationConstraints } from "@dnd-kit/dom";
import { DragDropProvider, PointerSensor, useDroppable } from "@dnd-kit/react";
import { useMemo, type ReactNode } from "react";

import { POINTER_ACTIVATION_DISTANCE } from "@/features/board/utils/pointer-activation";
import { parseISODate } from "@/features/board/utils/date-presets";
import { formatWeekdayDate } from "@/lib/dates";
import { dateLocale, t } from "@/i18n";

import type { CalendarTask } from "../types";
import { CALENDAR_TASK_DRAG_TYPE, dayDropId, rescheduleFromDrop, type CalendarDropData } from "../utils/calendar-dnd";
import { isSameMonth } from "../utils/calendar-range";
import { CalendarTaskChip } from "./calendar-task-item";

// Pointer only: a short move still counts as a click that opens the task. Keyboard (and touch)
// users move a task with its change-date button instead.
const CALENDAR_DRAG_SENSORS = [
  PointerSensor.configure({
    activationConstraints: [new PointerActivationConstraints.Distance({ value: POINTER_ACTIVATION_DISTANCE })],
  }),
];

interface CalendarGridProps {
  view: "month" | "week";
  days: string[];
  anchor: string;
  today: string;
  byDay: Map<string, CalendarTask[]>;
  onOpen: (task: CalendarTask) => void;
  onReschedule: (task: CalendarTask) => void;
  onMove: (task: CalendarTask, dueDate: string) => void;
  onCreate: (day: string) => void;
}

/** Month (six weeks) or week grid. Tasks can be dragged between days. */
export function CalendarGrid({ view, days, anchor, today, byDay, onOpen, onReschedule, onMove, onCreate }: CalendarGridProps) {
  const isWeek = view === "week";
  return (
    <DragDropProvider
      sensors={CALENDAR_DRAG_SENSORS}
      onDragEnd={(event) => {
        const move = rescheduleFromDrop(event.operation.source?.data, event.operation.target?.data, event.canceled);
        if (move) onMove(move.task, move.dueDate);
      }}
    >
      <div
        data-calendar-layout={view}
        className={`flex flex-col overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] ${
          isWeek ? "min-h-[24rem]" : "h-full min-h-[38rem]"
        }`}
      >
        <div className="grid shrink-0 grid-cols-7 border-b border-[var(--app-border)] bg-[var(--app-surface-muted)]" aria-hidden>
          {days.slice(0, 7).map((day) => (
            <div key={day} className="px-2 py-2 text-center text-xs font-semibold text-[var(--app-text-muted)]">
              {parseISODate(day).toLocaleDateString(dateLocale(), { weekday: "short" })}
            </div>
          ))}
        </div>
        <div aria-label={t("calendar.gridLabel")} role="group" className={`grid min-h-0 flex-1 grid-cols-7 ${isWeek ? "" : "grid-rows-6"}`}>
          {days.map((day) => (
            <DayCell
              key={day}
              day={day}
              today={today}
              muted={!isWeek && !isSameMonth(day, anchor)}
              tall={isWeek}
              onCreate={onCreate}
            >
              {(byDay.get(day) ?? []).map((task) => (
                <CalendarTaskChip key={task.id} task={task} onOpen={onOpen} onReschedule={onReschedule} />
              ))}
            </DayCell>
          ))}
        </div>
      </div>
    </DragDropProvider>
  );
}

function DayCell({
  day,
  today,
  muted,
  tall,
  onCreate,
  children,
}: {
  day: string;
  today: string;
  muted: boolean;
  tall: boolean;
  onCreate: (day: string) => void;
  children: ReactNode;
}) {
  const data = useMemo<CalendarDropData>(() => ({ day }), [day]);
  const { ref, isDropTarget } = useDroppable({ id: dayDropId(day), type: "calendar-day", accept: CALENDAR_TASK_DRAG_TYPE, data });
  const isToday = day === today;
  const label = formatWeekdayDate(day);
  return (
    <div
      ref={ref}
      role="group"
      aria-label={isToday ? `${label} · ${t("calendar.today")}` : label}
      data-calendar-day={day}
      data-drop-target={isDropTarget ? "true" : undefined}
      className={`flex min-h-0 min-w-0 flex-col gap-1 border-b border-r border-[var(--app-border)] p-1.5 ${
        tall ? "min-h-[22rem]" : ""
      } ${muted ? "bg-[var(--app-surface-muted)]" : ""} ${
        isDropTarget ? "bg-[var(--app-primary-soft)] outline outline-2 -outline-offset-2 outline-[var(--app-primary)]" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => onCreate(day)}
        aria-label={t("calendar.addTaskOn", { date: label })}
        title={t("calendar.addTask")}
        className={`flex h-6 min-w-[1.5rem] shrink-0 items-center justify-center self-start rounded-full px-1 text-xs font-semibold hover:bg-[var(--app-primary-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--app-primary)] ${
          isToday
            ? "bg-[var(--app-primary)] text-white hover:bg-[var(--app-primary)] dark:text-[var(--app-bg)]"
            : muted
              ? "text-[var(--app-text-muted)] opacity-70"
              : "text-[var(--app-text-muted)]"
        }`}
      >
        {parseISODate(day).getDate()}
      </button>
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">{children}</div>
    </div>
  );
}
