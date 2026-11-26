/**
 * Calendar date math. Every day is a local "YYYY-MM-DD" string built from the browser's own
 * calendar (never `toISOString`, which is UTC), so "today" and the grid follow the user's timezone.
 */
import {
  formatMonthLabel,
  formatWeekRangeLabel,
  monthRange,
  parseISODate,
  toISODate,
  weekRange,
} from "@/features/board/utils/date-presets";

import type { CalendarRange, CalendarTask, CalendarView } from "../types";

export const CALENDAR_VIEWS: CalendarView[] = ["month", "week", "agenda"];

export function isCalendarView(value: unknown): value is CalendarView {
  return value === "month" || value === "week" || value === "agenda";
}

export function addDays(iso: string, days: number): string {
  const date = parseISODate(iso);
  return toISODate(new Date(date.getFullYear(), date.getMonth(), date.getDate() + days));
}

/** Whole days from `from` to `to` (negative when `to` is earlier). Safe across DST changes. */
export function daysBetween(from: string, to: string): number {
  const a = parseISODate(from);
  const b = parseISODate(to);
  return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
}

/** Every day from `start` to `end`, inclusive. */
export function daysInRange(range: CalendarRange): string[] {
  const count = daysBetween(range.start, range.end) + 1;
  return Array.from({ length: Math.max(count, 0) }, (_, index) => addDays(range.start, index));
}

/** The six Monday-first weeks (42 days) a month grid shows for the month containing `anchor`. */
export function monthGridRange(anchor: string): CalendarRange {
  const first = monthRange(anchor)[0] as string;
  const offset = (parseISODate(first).getDay() + 6) % 7;
  const start = addDays(first, -offset);
  return { start, end: addDays(start, 41) };
}

/**
 * The days on screen, which is exactly what the calendar asks the server for.
 * - Month grid: the 42-day grid, including the end of the previous and start of the next month.
 * - Week: Monday to Sunday.
 * - Agenda (and month on a small screen, which is shown as an agenda): the month itself.
 */
export function visibleRange(view: CalendarView, anchor: string, compact = false): CalendarRange {
  if (view === "week") {
    const [start, end] = weekRange(anchor);
    return { start: start as string, end: end as string };
  }
  if (view === "month" && !compact) return monthGridRange(anchor);
  const [start, end] = monthRange(anchor);
  return { start: start as string, end: end as string };
}

/** The anchor day one period earlier (`step` -1) or later (+1). Months keep the 1st. */
export function shiftAnchor(view: CalendarView, anchor: string, step: number): string {
  if (view === "week") return addDays(anchor, 7 * step);
  const date = parseISODate(anchor);
  return toISODate(new Date(date.getFullYear(), date.getMonth() + step, 1));
}

export function rangeLabel(view: CalendarView, anchor: string): string {
  if (view === "week") {
    const range = visibleRange("week", anchor);
    return formatWeekRangeLabel(range.start, range.end);
  }
  return formatMonthLabel(anchor);
}

export function isSameMonth(day: string, anchor: string): boolean {
  return day.slice(0, 7) === anchor.slice(0, 7);
}

/** Tasks per due day, keeping the server's order (priority, then title) within a day. */
export function groupByDay(items: CalendarTask[]): Map<string, CalendarTask[]> {
  const map = new Map<string, CalendarTask[]>();
  for (const item of items) {
    const list = map.get(item.due_date);
    if (list) list.push(item);
    else map.set(item.due_date, [item]);
  }
  return map;
}

/**
 * The dates a task gets when it moves to `dueDate`: the start moves by the same number of days so
 * a multi-day task keeps its length.
 */
export function rescheduledDates(
  task: Pick<CalendarTask, "start_date" | "due_date">,
  dueDate: string,
): { start_date: string; due_date: string } {
  const shift = daysBetween(task.due_date, dueDate);
  return { start_date: addDays(task.start_date, shift), due_date: dueDate };
}
