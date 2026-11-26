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
  /** Tasks matching any of these priorities are shown; empty shows every priority. */
  priorities: Priority[];
  query: string;
  /** Tasks in any of these categories are shown; empty shows every category. */
  categoryIds: string[];
  /** Tasks matching any selected user or "unassigned" are shown; empty shows everyone. */
  assigneeIds: string[];
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
/** Someone on a board who a task can be assigned to. */
export interface TaskAssignee {
  id: string;
  display_name: string;
  login_id: string;
}

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
  /** Everyone the task is assigned to (can be several). */
  assignees?: TaskAssignee[];
}

/**
 * A sub-task as listed under its parent. Sub-tasks are full tasks (open one with its id for
 * everything); they are left out of task lists and reached through the parent.
 */
export interface TaskSubtask {
  id: string;
  /** The parent task. */
  task_id: string;
  title: string;
  is_completed: boolean;
  position: number;
  column_id: string;
  start_date: string;
  due_date: string;
  priority: Priority;
  completed_at: string | null;
  assignees?: TaskAssignee[];
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
  remind_at?: string | null;
  created_at: string;
  updated_at: string;
  links: TaskLink[];
  attachments: TaskAttachment[];
  subtasks: TaskSubtask[];
  /** Set when this task is a sub-task. */
  parent?: { id: string; title: string } | null;
  category: Category;
  /** Everyone the task is assigned to (can be several). */
  assignees?: TaskAssignee[];
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
  /** Your personal folder for this board; null when ungrouped or shared with you. */
  folder_id?: string | null;
  created_at: string;
  updated_at: string;
  total_tasks: number;
  completed_tasks: number;
  status_count: number;
  attachment_count: number;
  /** "member" when the board is shared with you by someone else. */
  role?: BoardRole;
  owner_name?: string | null;
  member_count?: number;
}

export interface BoardFolder {
  id: string;
  name: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export type BoardRole = "owner" | "member";

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
  folder_id?: string | null;
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
  role?: BoardRole;
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
  /** ISO timestamp with offset; null clears the reminder. */
  remind_at?: string | null;
  /** Everyone to assign; an empty list leaves the task unassigned. */
  assignee_ids?: string[];
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
  remind_at?: string | null;
  assignee_ids?: string[];
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

export interface BoardPerson {
  user_id: string;
  display_name: string;
  login_id: string;
  role: BoardRole;
}

export interface BoardMembers {
  people: BoardPerson[];
  /** True for the owner: can add and remove members. */
  can_manage: boolean;
}

export interface BoardInviteResult {
  status: "added";
  members: BoardMembers;
}
