import type { RecurrenceFreq } from "@/features/board/types";
import { formatList, monthName, t, weekdayName } from "@/i18n";
import { formatLongDate } from "@/lib/dates";

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
  if (rule.end_date) parts.push(t("repeat.until", { date: formatLongDate(rule.end_date) }));
  if (rule.occurrence_limit) parts.push(t("repeat.occurrences", { count: rule.occurrence_limit }));
  return parts.join(" · ");
}

function formatRecurrenceCore(rule: RecurrenceFormatInput): string {
  const n = Math.max(1, rule.interval || 1);
  if (rule.freq === "daily") {
    return n === 1 ? t("repeat.daily") : t("repeat.everyNDays", { n });
  }
  if (rule.freq === "weekly") {
    const days = [...(rule.weekdays ?? [])].filter((day) => day >= 0 && day <= 6).sort((a, b) => a - b);
    if (n === 1 && days.join(",") === "0,1,2,3,4") return t("repeat.weekdays");
    if (!days.length) return n === 1 ? t("repeat.weekly") : t("repeat.everyNWeeks", { n });
    const names = formatList(days.map((day) => weekdayName(day, "long")));
    return n === 1 ? t("repeat.weeklyOn", { days: names }) : t("repeat.everyNWeeksOn", { n, days: names });
  }
  if (rule.freq === "monthly") {
    if (!rule.month_day) return n === 1 ? t("repeat.monthly") : t("repeat.everyNMonths", { n });
    const day = rule.month_day;
    return n === 1 ? t("repeat.monthlyOnDay", { day }) : t("repeat.everyNMonthsOnDay", { n, day });
  }
  const month = monthFromStart(rule.start_date);
  const day = rule.month_day;
  if (month && day) {
    const name = monthName(month);
    return n === 1 ? t("repeat.yearlyOn", { month: name, day }) : t("repeat.everyNYearsOn", { n, month: name, day });
  }
  if (day) return n === 1 ? t("repeat.yearlyOnDay", { day }) : t("repeat.everyNYearsOnDay", { n, day });
  return n === 1 ? t("repeat.yearly") : t("repeat.everyNYears", { n });
}

function monthFromStart(startDate: string): number | null {
  const month = Number(startDate.split("-")[1]);
  return month >= 1 && month <= 12 ? month : null;
}
