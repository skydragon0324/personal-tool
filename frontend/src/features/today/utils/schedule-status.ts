import type { ScheduleTimeStatus } from "../types";

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

export const SCHEDULE_STATUS_LABEL: Record<ScheduleTimeStatus, string> = {
  upcoming: "Upcoming",
  in_progress: "In progress",
  passed: "Passed",
  completed: "Completed",
};
