export type Priority = "low" | "medium" | "high";

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
export interface TaskSummary {
  id: string;
  column_id: string;
  title: string;
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
}

export interface TaskDetail {
  id: string;
  column_id: string;
  title: string;
  description: string | null;
  content: TiptapJSON | null;
  content_text: string | null;
  content_schema_version: number;
  due_date: string;
  priority: Priority;
  position: number;
  version: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  links: TaskLink[];
  attachments: TaskAttachment[];
}

export interface BoardColumn {
  id: string;
  name: string;
  position: number;
  is_done: boolean;
  tasks: TaskSummary[];
}

export interface BoardSummary {
  total: number;
  completed: number;
  remaining: number;
}

export interface BoardView {
  id: string;
  name: string;
  timezone: string;
  created_at: string;
  updated_at: string;
  start_date: string;
  end_date: string;
  summary: BoardSummary;
  columns: BoardColumn[];
}

export interface TaskCreate {
  column_id: string;
  title: string;
  description?: string | null;
  content?: TiptapJSON | null;
  due_date: string;
  priority?: Priority;
  links?: TaskLinkInput[];
}

export interface TaskUpdate {
  title?: string;
  description?: string | null;
  content?: TiptapJSON | null;
  due_date?: string;
  priority?: Priority;
  links?: TaskLinkInput[];
}

export interface TaskMove {
  target_column_id: string;
  target_position: number;
  expected_version: number;
}

export type TasksByColumn = Record<string, TaskSummary[]>;

/** @deprecated use TaskSummary */
export type Task = TaskSummary;
