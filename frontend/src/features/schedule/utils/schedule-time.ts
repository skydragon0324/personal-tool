import { dateLocale, weekdayName } from "@/i18n";

import { toISODate, parseISODate, weekRange } from "@/features/board/utils/date-presets";
import { todayISO } from "@/lib/dates";

export const SLOT_MINUTES = 30;
export const SLOTS_PER_DAY = (24 * 60) / SLOT_MINUTES;

/** Short weekday names, Monday first, in the current language. */
export function weekdayLabels(): string[] {
  return [0, 1, 2, 3, 4, 5, 6].map((index) => weekdayName(index));
}

export function mondayOf(iso: string): string {
  return weekRange(iso)[0] as string;
}

export function addDays(iso: string, days: number): string {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function weekdayIndex(iso: string): number {
  const date = parseISODate(iso);
  return (date.getDay() + 6) % 7;
}

export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

export function parseTimeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
}

export function formatTimeLabel(value: string): string {
  const minutes = parseTimeToMinutes(value);
  const date = new Date();
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date.toLocaleTimeString(dateLocale(), { hour: "numeric", minute: "2-digit" });
}

export function slotStartMinutes(slot: number): number {
  return slot * SLOT_MINUTES;
}

export function timeToSlot(value: string): number {
  return Math.floor(parseTimeToMinutes(value) / SLOT_MINUTES);
}

export function slotCount(start: string, end: string): number {
  return Math.max(1, Math.ceil((parseTimeToMinutes(end) - parseTimeToMinutes(start)) / SLOT_MINUTES));
}

export function shiftIso(iso: string, view: "day" | "week", delta: number): string {
  return addDays(iso, view === "week" ? delta * 7 : delta);
}

export function currentWeekStart(today = todayISO()): string {
  return mondayOf(today);
}
