"use client";

import type { Task } from "@/lib/types";
import { formatDisplayDate } from "@/lib/dates";

const priorityStyles: Record<Task["priority"], string> = {
  high: "bg-rose-100 text-rose-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-slate-100 text-slate-700",
};

interface TaskItemProps {
  task: Task;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  busy?: boolean;
}

export function TaskItem({
  task,
  onToggle,
  onEdit,
  onDelete,
  busy = false,
}: TaskItemProps) {
  return (
    <li className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm transition hover:border-slate-300">
      <div className="flex gap-3">
        <input
          type="checkbox"
          checked={task.completed}
          onChange={() => onToggle(task)}
          disabled={busy}
          aria-label={`Mark "${task.title}" as ${task.completed ? "incomplete" : "complete"}`}
          className="mt-1 h-4 w-4 accent-teal-700"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3
                className={`font-medium text-ink ${
                  task.completed ? "text-slate-400 line-through" : ""
                }`}
              >
                {task.title}
              </h3>
              {task.description ? (
                <p
                  className={`mt-1 whitespace-pre-wrap text-sm ${
                    task.completed ? "text-slate-400" : "text-slate-600"
                  }`}
                >
                  {task.description}
                </p>
              ) : null}
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${priorityStyles[task.priority]}`}
            >
              {task.priority}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-500">
              Due {formatDisplayDate(task.due_date)}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onEdit(task)}
                disabled={busy}
                className="text-sm font-medium text-slate-600 transition hover:text-ink disabled:opacity-50"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => onDelete(task)}
                disabled={busy}
                className="text-sm font-medium text-rose-600 transition hover:text-rose-800 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}
