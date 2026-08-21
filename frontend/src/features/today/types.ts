import type { Priority } from "@/features/board/types";
import type { ScheduleKind, SchedulePriority } from "@/features/schedule/types";

export interface TodayProgress {
  total: number;
  completed: number;
  remaining: number;
  percentage: number;
}

export type DeadlineStatus = "overdue" | "due_today" | "starts_today" | "in_progress" | "completed";

export interface TodayTask {
  id: string;
  title: string;
  start_date: string;
  due_date: string;
  priority: Priority;
  completed_at: string | null;
  board_id: string;
  board_name: string;
  board_color: string;
  board_icon_name: string | null;
  status_id: string;
  status_name: string;
  status_color: string;
  status_is_done: boolean;
  subtask_completed: number;
  subtask_total: number;
  deadline_status: DeadlineStatus;
}

export interface TodaySchedule {
  id: string;
  title: string;
  kind: ScheduleKind;
  weekdays: number[];
  week_start: string | null;
  start_time: string;
  end_time: string;
  priority: SchedulePriority | null;
  color: string;
  notes: string;
  is_completed: boolean;
  completed_at: string | null;
}

export interface TodayPinnedNote {
  id: string;
  title: string;
  preview: string;
  priority: Priority | null;
  updated_at: string;
}

export interface TodayResponse {
  date: string;
  task_progress: TodayProgress;
  schedule_progress: TodayProgress;
  active_tasks: TodayTask[];
  overdue_tasks: TodayTask[];
  schedules: TodaySchedule[];
  pinned_notes: TodayPinnedNote[];
  pinned_notes_total: number;
}

export type ScheduleTimeStatus = "upcoming" | "in_progress" | "passed" | "completed";
