export type DateRangeMode = "year" | "month" | "week" | "day" | "custom" | "all";
export type DateField = "due_date" | "created_at";
export type DateRangeValue = [string | null, string | null];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseISODate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function pickerToISO(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return toISODate(value);
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  return null;
}

export function yearRange(year: number): DateRangeValue {
  return [`${year}-01-01`, `${year}-12-31`];
}

export function monthRange(iso: string): DateRangeValue {
  const date = parseISODate(iso);
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return [toISODate(start), toISODate(end)];
}

export function weekRange(iso: string): DateRangeValue {
  const date = parseISODate(iso);
  const day = date.getDay();
  const offset = day === 0 ? 6 : day - 1;
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate() - offset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return [toISODate(start), toISODate(end)];
}

export function dayRange(iso: string): DateRangeValue {
  return [iso, iso];
}

/** Kept for migrating the previous Next 30 days preference. */
export function next30Range(iso: string): DateRangeValue {
  const start = parseISODate(iso);
  const end = new Date(start);
  end.setDate(start.getDate() + 29);
  return [toISODate(start), toISODate(end)];
}

export function rangeForMode(
  mode: DateRangeMode,
  today: string,
  anchor?: string | null,
): DateRangeValue {
  const iso = anchor || today;
  switch (mode) {
    case "year":
      return yearRange(parseISODate(iso).getFullYear());
    case "month":
      return monthRange(iso);
    case "week":
      return weekRange(iso);
    case "day":
      return dayRange(iso);
    case "all":
      return [null, null];
    case "custom":
      return [iso, iso];
    default:
      return monthRange(today);
  }
}

export function migrateDateRangeMode(value: unknown): DateRangeMode {
  switch (value) {
    case "year":
      return "year";
    case "month":
    case "this_month":
      return "month";
    case "week":
    case "this_week":
      return "week";
    case "day":
    case "today":
      return "day";
    case "custom":
    case "next_30":
      return "custom";
    case "all":
      return "all";
    default:
      return "month";
  }
}

export const DEFAULT_FILTERS = {
  priority: "" as const,
  query: "",
  categoryId: "",
  dateField: "due_date" as DateField,
  rangeMode: "month" as DateRangeMode,
};

export function dateInRange(
  value: string,
  start: string | null,
  end: string | null,
  unbounded: boolean,
): boolean {
  if (unbounded || !start || !end) return true;
  return value >= start && value <= end;
}

export function expandRangeToInclude(range: DateRangeValue, iso: string): DateRangeValue {
  if (!range[0] || !range[1]) return [iso, iso];
  const start = range[0] < iso ? range[0] : iso;
  const end = range[1] > iso ? range[1] : iso;
  return [start, end];
}

export function createdAtDate(isoDateTime: string): string {
  return isoDateTime.slice(0, 10);
}

export function formatYearLabel(iso: string): string {
  return String(parseISODate(iso).getFullYear());
}

export function formatMonthLabel(iso: string): string {
  return parseISODate(iso).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function formatWeekRangeLabel(start: string, end: string): string {
  const startDate = parseISODate(start);
  const endDate = parseISODate(end);
  const startPart = startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const endPart = endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (startDate.getFullYear() === endDate.getFullYear()) {
    return `${startPart} – ${endPart}, ${endDate.getFullYear()}`;
  }
  return `${startPart}, ${startDate.getFullYear()} – ${endPart}, ${endDate.getFullYear()}`;
}
