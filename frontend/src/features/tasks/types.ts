/** One change to a value, e.g. a new status or due date (dates and times as ISO strings). */
export interface TaskValueChange {
  field: "title" | "board" | "status" | "category" | "priority" | "start_date" | "due_date" | "reminder" | "repeat";
  from: string | boolean | null;
  to: string | boolean | null;
}

/** Items added to or removed from a list on the task. */
export interface TaskListChange {
  field: "assignees" | "subtasks" | "links" | "files";
  added: string[];
  removed: string[];
}

/** The details text changed (the text itself is not kept in the history). */
export interface TaskTextChange {
  field: "details";
}

export type TaskChange = TaskValueChange | TaskListChange | TaskTextChange;

export interface TaskHistoryEntry {
  id: string;
  created_at: string;
  actor_id: string | null;
  actor_name: string;
  action: "created" | "updated";
  changes: TaskChange[];
}
