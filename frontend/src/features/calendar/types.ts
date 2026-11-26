import type { Priority } from "@/features/board/types";

export type CalendarView = "month" | "week" | "agenda";

export interface CalendarTask {
  id: string;
  title: string;
  start_date: string;
  due_date: string;
  is_done: boolean;
  priority: Priority;
  board_id: string;
  board_name: string;
  board_color: string;
  status_id: string;
  status_name: string;
}

export interface CalendarTaskList {
  start_date: string;
  end_date: string;
  items: CalendarTask[];
  /** The range holds more tasks than `limit`; only the soonest are returned. */
  truncated: boolean;
  limit: number;
}

export interface CalendarRange {
  start: string;
  end: string;
}
