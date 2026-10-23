import type { DeadlineStatus } from "../types";
import { t } from "@/i18n";

export function deadlineStatusLabel(status: DeadlineStatus): string {
  if (status === "overdue") return t("today.deadlineOverdue");
  if (status === "due_today") return t("today.deadlineDueToday");
  if (status === "starts_today") return t("today.deadlineStartsToday");
  if (status === "in_progress") return t("today.deadlineInProgress");
  return t("today.deadlineCompleted");
}

export function scheduleKindLabel(kind: "routine" | "this_week"): string {
  return kind === "routine" ? t("schedule.routine") : t("schedule.thisWeekOnly");
}
