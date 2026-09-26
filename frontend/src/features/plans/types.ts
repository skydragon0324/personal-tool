export interface PlanItem {
  id: string;
  day_id: string;
  title: string;
  is_completed: boolean;
  completed_at: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface PlanDay {
  id: string;
  plan_id: string;
  /** YYYY-MM-DD */
  day: string;
  title: string;
  items: PlanItem[];
  created_at: string;
  updated_at: string;
}

export interface PlanSummary {
  id: string;
  name: string;
  description: string;
  position: number;
  day_count: number;
  item_count: number;
  completed_count: number;
  first_day: string | null;
  last_day: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlanDetail extends PlanSummary {
  days: PlanDay[];
}

export interface PlanCreate {
  name: string;
  description?: string;
}

export type PlanUpdate = Partial<PlanCreate>;

export interface PlanDayCreate {
  day: string;
  title?: string;
}

export type PlanDayUpdate = Partial<PlanDayCreate>;

export interface PlanItemUpdate {
  title?: string;
  is_completed?: boolean;
}

export type PlanState = "empty" | "upcoming" | "active" | "finished";

export interface PlanInsight {
  id: string;
  name: string;
  day_count: number;
  item_count: number;
  completed_count: number;
  completion_rate: number;
  first_day: string | null;
  last_day: string | null;
  state: PlanState;
  days_done: number;
  days_left: number;
  missed_items: number;
  next_day: string | null;
}

export interface PlanTodayItem {
  id: string;
  title: string;
  is_completed: boolean;
  plan_id: string;
  plan_name: string;
  day_id: string;
}

export interface PlanTimelinePoint {
  day: string;
  planned: number;
  completed: number;
}

export interface PlanBehindDay {
  plan_id: string;
  plan_name: string;
  day_id: string;
  day: string;
  open_items: number;
  total_items: number;
}

export interface PlanOverview {
  today: string;
  totals: {
    plans: number;
    active_plans: number;
    days: number;
    items: number;
    completed: number;
    completion_rate: number;
    today_total: number;
    today_completed: number;
    missed_items: number;
  };
  plans: PlanInsight[];
  today_items: PlanTodayItem[];
  timeline: PlanTimelinePoint[];
  behind: PlanBehindDay[];
}
