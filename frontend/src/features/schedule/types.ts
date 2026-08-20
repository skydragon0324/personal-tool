export type ScheduleKind = "routine" | "this_week";
export type SchedulePriority = "low" | "medium" | "high";

export interface ScheduleEntry {
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
  created_at: string;
  updated_at: string;
}

export interface ScheduleEntryCreate {
  title: string;
  kind: ScheduleKind;
  weekdays: number[];
  week_start?: string | null;
  start_time: string;
  end_time: string;
  priority?: SchedulePriority | null;
  color?: string;
  notes?: string;
}

export type ScheduleEntryUpdate = Partial<ScheduleEntryCreate>;

export type ScheduleView = "day" | "week";
