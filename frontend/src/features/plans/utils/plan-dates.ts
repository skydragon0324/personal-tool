import { todayISO } from "@/lib/dates";

function parse(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toISO(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** "Monday, September 23" — the year is added only when it is not the current one. */
export function formatPlanDay(isoDate: string, today: string = todayISO()): string {
  const date = parse(isoDate);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    ...(isoDate.slice(0, 4) === today.slice(0, 4) ? {} : { year: "numeric" }),
  });
}

/** "Sep 23 – Sep 26" style range for plan cards. */
export function formatPlanRange(first: string | null, last: string | null): string | null {
  if (!first || !last) return null;
  const short = (value: string) =>
    parse(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return first === last ? short(first) : `${short(first)} – ${short(last)}`;
}

/** Suggest the day after the plan's last day, or today when it has none yet. */
export function nextPlanDay(existing: string[], today: string = todayISO()): string {
  if (!existing.length) return today;
  const last = [...existing].sort()[existing.length - 1];
  const next = parse(last);
  next.setDate(next.getDate() + 1);
  return toISO(next);
}
