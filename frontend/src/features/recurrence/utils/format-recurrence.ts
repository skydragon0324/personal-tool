import type { RecurrenceFreq } from "@/features/board/types";
import { formatLongDate } from "@/lib/dates";

const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export interface RecurrenceFormatInput {
  freq: RecurrenceFreq;
  interval: number;
  weekdays: number[];
  month_day: number | null;
  start_date: string;
  end_date: string | null;
  occurrence_limit: number | null;
}

export function formatRecurrenceRule(rule: RecurrenceFormatInput): string {
  const parts = [formatRecurrenceCore(rule)];
  if (rule.end_date) parts.push(`until ${formatLongDate(rule.end_date)}`);
  if (rule.occurrence_limit) {
    parts.push(rule.occurrence_limit === 1 ? "1 occurrence" : `${rule.occurrence_limit} occurrences`);
  }
  return parts.join(" · ");
}

function formatRecurrenceCore(rule: RecurrenceFormatInput): string {
  const interval = Math.max(1, rule.interval || 1);
  if (rule.freq === "daily") {
    return interval === 1 ? "Daily" : `Every ${interval} days`;
  }
  if (rule.freq === "weekly") {
    const days = [...(rule.weekdays ?? [])].filter((day) => day >= 0 && day <= 6).sort((a, b) => a - b);
    if (interval === 1 && days.join(",") === "0,1,2,3,4") return "Weekdays";
    const names = days.map((day) => WEEKDAY_NAMES[day]);
    const on = names.length ? ` on ${formatNameList(names)}` : "";
    return interval === 1 ? `Weekly${on}` : `Every ${interval} weeks${on}`;
  }
  if (rule.freq === "monthly") {
    const onDay = rule.month_day ? ` on day ${rule.month_day}` : "";
    return interval === 1 ? `Monthly${onDay}` : `Every ${interval} months${onDay}`;
  }
  const month = monthNameFromStart(rule.start_date);
  const on =
    month && rule.month_day ? ` on ${month} ${rule.month_day}` : rule.month_day ? ` on day ${rule.month_day}` : "";
  return interval === 1 ? `Yearly${on}` : `Every ${interval} years${on}`;
}

function monthNameFromStart(startDate: string): string | null {
  const month = Number(startDate.split("-")[1]);
  if (!month || month < 1 || month > 12) return null;
  return MONTH_NAMES[month - 1];
}

function formatNameList(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}
