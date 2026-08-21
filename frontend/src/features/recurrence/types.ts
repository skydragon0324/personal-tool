import type { Priority, RecurrenceFreq, RecurrenceStatus } from "@/features/board/types";

export type RecurrenceSeriesStatus = RecurrenceStatus;
export type RecurrenceSeriesTab = "active" | "stopped";
export type RecurrenceSeriesPageSize = 25 | 50 | 100;

export interface RecurrenceSeriesListParams {
  board_id?: string;
  status?: RecurrenceSeriesStatus;
  offset?: number;
  limit?: number;
}

export interface RecurrenceSeriesListItem {
  id: string;
  board_id: string;
  board_name: string;
  board_archived: boolean;
  default_column_id: string | null;
  default_column_name: string | null;
  category_id: string;
  category_name: string;
  title: string;
  priority: Priority;
  timezone: string;
  freq: RecurrenceFreq;
  interval: number;
  weekdays: number[];
  month_day: number | null;
  start_date: string;
  end_date: string | null;
  occurrence_limit: number | null;
  status: RecurrenceSeriesStatus;
  generated_through: string | null;
  next_occurrence_date: string | null;
  open_occurrence_count: number;
  completed_occurrence_count: number;
  detached_occurrence_count: number;
  created_at: string;
  updated_at: string;
}

export interface RecurrenceSeriesListResponse {
  items: RecurrenceSeriesListItem[];
  total: number;
  offset: number;
  limit: number;
}
