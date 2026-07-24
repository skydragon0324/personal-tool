export type Priority = "low" | "medium" | "high";

export interface Task {
  id: number;
  title: string;
  description: string | null;
  due_date: string;
  priority: Priority;
  completed: boolean;
  created_at: string;
}

export interface TaskCreate {
  title: string;
  description?: string | null;
  due_date: string;
  priority: Priority;
  completed?: boolean;
}

export interface TaskUpdate {
  title?: string;
  description?: string | null;
  due_date?: string;
  priority?: Priority;
  completed?: boolean;
}

export interface DashboardSummary {
  total_today: number;
  completed_today: number;
  remaining_today: number;
}

export interface TaskFilters {
  due_date: string;
  completed: "" | "true" | "false";
  priority: "" | Priority;
}
