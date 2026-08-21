import type { BoardQueryParams, BoardView, TaskDetail, TaskSummary, TasksByColumn } from "../types";

export const boardKeys = {
  all: ["board"] as const,
  list: ["boards"] as const,
  detail: (boardId: string) => ["boards", boardId] as const,
  views: (boardId: string) => ["board", boardId] as const,
  view: (params: BoardQueryParams) =>
    [
      ...boardKeys.all,
      params.boardId,
      params.unbounded ? "all" : `${params.startDate}:${params.endDate}`,
      params.dateField,
    ] as const,
};

export const categoryKeys = {
  list: (boardId: string) => ["categories", boardId] as const,
};

export const columnKeys = {
  list: (boardId: string) => ["columns", boardId] as const,
};

export const taskKeys = {
  detail: (taskId: string) => ["task", taskId] as const,
};

export function tasksByColumnFromView(view: BoardView): TasksByColumn {
  const map: TasksByColumn = {};
  for (const column of view.columns) {
    map[column.id] = [...column.tasks].sort((a, b) => a.position - b.position);
  }
  return map;
}

export function applyDetailToView(view: BoardView, task: TaskDetail): BoardView {
  const summary: TaskSummary = {
    id: task.id,
    column_id: task.column_id,
    title: task.title,
    start_date: task.start_date,
    due_date: task.due_date,
    priority: task.priority,
    position: task.position,
    version: task.version,
    completed_at: task.completed_at,
    created_at: task.created_at,
    updated_at: task.updated_at,
    content_preview: (task.content_text || task.description || "").slice(0, 140),
    checklist_completed: 0,
    checklist_total: 0,
    link_count: task.links.length,
    attachment_count: task.attachments.length,
    subtask_total: task.subtasks?.length ?? 0,
    subtask_completed: task.subtasks?.filter((item) => item.is_completed).length ?? 0,
    category: task.category,
    recurrence: task.recurrence ?? null,
  };

  // Counts will refresh on invalidate; approximate from detail when possible
  const columns = view.columns.map((column) => {
    const without = column.tasks.filter((t) => t.id !== task.id);
    if (column.id === task.column_id) {
      const next = [...without, summary].sort((a, b) => a.position - b.position);
      return { ...column, tasks: next };
    }
    return { ...column, tasks: without };
  });

  const allTasks = columns.flatMap((c) => c.tasks);
  const doneIds = new Set(columns.filter((c) => c.is_done).map((c) => c.id));
  const completed = allTasks.filter((t) => doneIds.has(t.column_id)).length;

  return {
    ...view,
    columns,
    summary: {
      total: allTasks.length,
      completed,
      remaining: allTasks.length - completed,
    },
  };
}
