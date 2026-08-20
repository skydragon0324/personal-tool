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
