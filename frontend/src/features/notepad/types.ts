export type NotePriority = "low" | "medium" | "high";

export interface Note {
  id: string;
  title: string;
  body: string;
  priority: NotePriority | null;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface NoteCreate {
  title: string;
  body?: string;
  priority?: NotePriority | null;
  is_pinned?: boolean;
}

export interface NoteUpdate {
  title?: string;
  body?: string;
  priority?: NotePriority | null;
  is_pinned?: boolean;
}

export interface NoteListParams {
  query?: string;
  priority?: NotePriority;
  pinned?: boolean;
}
