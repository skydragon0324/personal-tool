import type { BoardView, TaskDetail, TaskSummary, TasksByColumn } from "../types";

export const boardKeys = {
  all: ["board"] as const,
  view: (boardId: string, startDate: string, endDate: string) =>
    [...boardKeys.all, boardId, startDate, endDate] as const,
};

export const taskKeys = {
  detail: (taskId: string) => ["task", taskId] as const,
};

export function tasksByColumnFromView(view: BoardView): TasksByColumn {
  const map: TasksByColumn = {};
  for (const column of view.columns) {
    map[column.id] = [...column.tasks].sort((a, b) => {
      if (a.due_date !== b.due_date) return a.due_date.localeCompare(b.due_date);
      return a.position - b.position;
    });
  }
  return map;
}

export function applyDetailToView(view: BoardView, task: TaskDetail): BoardView {
  const summary: TaskSummary = {
    id: task.id,
    column_id: task.column_id,
    title: task.title,
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
  };

  // Counts will refresh on invalidate; approximate from detail when possible
  const columns = view.columns.map((column) => {
    const without = column.tasks.filter((t) => t.id !== task.id);
    if (column.id === task.column_id) {
      const next = [...without, summary].sort((a, b) => {
        if (a.due_date !== b.due_date) return a.due_date.localeCompare(b.due_date);
        return a.position - b.position;
      });
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
