import type { ScheduleTimeStatus } from "../types";
import { t } from "@/i18n";

function localDateTime(isoDate: string, time: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  const [hours, minutes, seconds] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, seconds || 0);
}

export function scheduleTimeStatus(args: {
  date: string;
  startTime: string;
  endTime: string;
  isCompleted: boolean;
  now?: Date;
}): ScheduleTimeStatus {
  if (args.isCompleted) return "completed";
  const now = args.now ?? new Date();
  const start = localDateTime(args.date, args.startTime);
  const end = localDateTime(args.date, args.endTime);
  if (now < start) return "upcoming";
  if (now < end) return "in_progress";
  return "passed";
}

export function scheduleStatusLabel(status: ScheduleTimeStatus): string {
  if (status === "upcoming") return t("today.scheduleUpcoming");
  if (status === "in_progress") return t("today.scheduleInProgress");
  if (status === "passed") return t("today.schedulePassed");
  return t("today.scheduleCompleted");
}
