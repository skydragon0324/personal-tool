export interface DashboardBoardStats {
  id: string;
  name: string;
  color: string;
  icon_name: string | null;
  total: number;
  open: number;
  completed: number;
  completion_rate: number;
  overdue: number;
  due_today: number;
  status_count: number;
}

export interface DashboardAttentionItem {
  id: string;
  title: string;
  due_date: string;
  priority: "low" | "medium" | "high";
  board_id: string;
  board_name: string;
  status_id: string;
  status_name: string;
}

export interface DashboardSummary {
  today: string;
  active_boards: number;
  total_tasks: number;
  open_tasks: number;
  completed_tasks: number;
  completion_rate: number;
  overdue: number;
  due_today: number;
  boards: DashboardBoardStats[];
  priority: {
    high: number;
    medium: number;
    low: number;
  };
  attention: {
    overdue: DashboardAttentionItem[];
    due_today: DashboardAttentionItem[];
  };
}

export interface DashboardTaskRow {
  id: string;
  title: string;
  board_id: string;
  board_name: string;
  board_color: string;
  status_id: string;
  status_name: string;
  status_color: string;
  is_done: boolean;
  category_name: string;
  category_color: string;
  priority: "low" | "medium" | "high";
  start_date: string;
  due_date: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  assignees: Array<{ id: string; display_name: string }>;
  subtask_total: number;
  subtask_completed: number;
  is_recurring: boolean;
}

export interface DashboardTaskList {
  items: DashboardTaskRow[];
  /** More tasks exist than the list returns. */
  truncated: boolean;
}
