export type Priority = "low" | "medium" | "high";

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface CategoryDetail extends Category {
  board_id: string;
  position: number;
  created_at: string;
}

export interface BoardFilters {
  priority: Priority | "";
  query: string;
  categoryId: string;
}

export type TiptapJSON = Record<string, unknown>;

export interface TaskLink {
  id: string;
  label: string;
  url: string;
  position: number;
  created_at: string;
}

export interface TaskLinkInput {
  id?: string;
  label: string;
  url: string;
  position: number;
}

export type RecurrenceFreq = "daily" | "weekly" | "monthly" | "yearly";
export type RecurrenceStatus = "active" | "stopped" | "archived";
export type EditScope = "this" | "this_and_future" | "series";
export type DeleteScope = "this" | "this_and_future" | "series";

export interface RecurrenceInput {
  freq: RecurrenceFreq;
  interval?: number;
  weekdays?: number[];
  month_day?: number | null;
  until_date?: string | null;
  occurrence_limit?: number | null;
}

export interface RecurrenceRead {
  series_id: string;
  status: RecurrenceStatus;
  freq: RecurrenceFreq;
  interval: number;
  weekdays: number[];
  month_day: number | null;
  until_date: string | null;
  occurrence_limit: number | null;
  occurrence_date: string | null;
  original_occurrence_date: string | null;
  is_detached: boolean;
  occurrence_index: number | null;
}

export interface TaskAttachment {
  id: string;
  original_name: string;
  content_type: string;
  size_bytes: number;
  attachment_kind: "image" | "file" | string;
  created_at: string;
  download_url: string | null;
}

/** Board card payload — no full rich content. */
export interface TaskSummary {
  id: string;
  column_id: string;
  title: string;
  start_date: string;
  due_date: string;
  priority: Priority;
  position: number;
  version: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  content_preview: string;
  checklist_completed: number;
  checklist_total: number;
  link_count: number;
  attachment_count: number;
  subtask_total: number;
  subtask_completed: number;
  category: Category;
  recurrence?: RecurrenceRead | null;
}

export interface TaskSubtask {
  id: string;
  task_id: string;
  title: string;
  is_completed: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface TaskDetail {
  id: string;
  column_id: string;
  title: string;
  description: string | null;
  content: TiptapJSON | null;
  content_text: string | null;
  content_schema_version: number;
  start_date: string;
  due_date: string;
  priority: Priority;
  position: number;
  version: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  links: TaskLink[];
  attachments: TaskAttachment[];
  subtasks: TaskSubtask[];
  category: Category;
  recurrence?: RecurrenceRead | null;
}

export interface BoardColumn {
  id: string;
  name: string;
  color: string;
  icon_name: string | null;
  position: number;
  is_done: boolean;
  archived_at: string | null;
  tasks: TaskSummary[];
}

export interface ColumnDetail {
  id: string;
  board_id: string;
  name: string;
  color: string;
  icon_name: string | null;
  position: number;
  is_done: boolean;
  archived_at: string | null;
  created_at: string;
  task_count: number;
}

export interface BoardListItem {
  id: string;
  name: string;
  color: string;
  icon_name: string | null;
  timezone: string;
  position: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  total_tasks: number;
  completed_tasks: number;
  status_count: number;
  attachment_count: number;
}

export interface BoardStatusSeed {
  name: string;
  color: string;
  icon_name?: string | null;
  is_done: boolean;
  position: number;
}

export interface BoardCreate {
  name: string;
  color?: string;
  icon_name?: string | null;
  timezone?: string;
  statuses?: BoardStatusSeed[];
}

export interface BoardSummary {
  total: number;
  completed: number;
  remaining: number;
}

export interface BoardView {
  id: string;
  name: string;
  color?: string;
  icon_name?: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
  start_date: string;
  end_date: string;
  date_field: "due_date" | "created_at";
  unbounded: boolean;
  truncated: boolean;
  task_limit: number;
  summary: BoardSummary;
  columns: BoardColumn[];
}

export interface TaskCreate {
  column_id: string;
  category_id: string;
  title: string;
  description?: string | null;
  content?: TiptapJSON | null;
  start_date: string;
  due_date: string;
  priority?: Priority;
  links?: TaskLinkInput[];
  recurrence?: RecurrenceInput | null;
  edit_scope?: EditScope;
}

export interface TaskUpdate {
  title?: string;
  description?: string | null;
  content?: TiptapJSON | null;
  start_date?: string;
  due_date?: string;
  priority?: Priority;
  category_id?: string;
  links?: TaskLinkInput[];
  edit_scope?: EditScope;
  recurrence?: RecurrenceInput | null;
}

export interface TaskMove {
  target_column_id: string;
  expected_version: number;
  before_task_id?: string | null;
  after_task_id?: string | null;
  target_position?: number | null;
}

export type TasksByColumn = Record<string, TaskSummary[]>;

export interface BoardQueryParams {
  boardId: string;
  startDate: string;
  endDate: string;
  dateField: "due_date" | "created_at";
  unbounded: boolean;
}

/** @deprecated use TaskSummary */
export type Task = TaskSummary;
