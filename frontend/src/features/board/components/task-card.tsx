"use client";

import { useSortable } from "@dnd-kit/react/sortable";

import { PriorityBadge } from "@/features/tasks/components/priority-badge";
import { formatDisplayDate } from "@/lib/dates";
import type { TaskSummary } from "../types";

interface TaskCardProps {
  task: TaskSummary;
  index: number;
  columnId: string;
  showDueDate: boolean;
  dragEnabled: boolean;
  onEdit: (task: TaskSummary) => void;
  onDelete: (task: TaskSummary) => void;
}

export function TaskCard({
  task,
  index,
  columnId,
  showDueDate,
  dragEnabled,
  onEdit,
  onDelete,
}: TaskCardProps) {
  const { ref, handleRef, isDragging } = useSortable({
    id: task.id,
    index,
    type: "item",
    accept: "item",
    group: columnId,
    disabled: !dragEnabled,
  });

  return (
    <article
      ref={ref}
      data-dragging={isDragging || undefined}
      className={`rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm transition ${
        isDragging ? "opacity-40" : "opacity-100"
      }`}
    >
      <div className="flex items-start gap-2">
        {dragEnabled ? (
          <button
            type="button"
            ref={handleRef}
            aria-label={`Drag ${task.title}`}
            className="mt-0.5 shrink-0 cursor-grab rounded-md border border-slate-200 px-1.5 py-1 text-slate-500 hover:bg-slate-50 active:cursor-grabbing"
          >
            <span aria-hidden className="block leading-none">
              ⋮⋮
            </span>
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium text-ink">{task.title}</h3>
            <PriorityBadge priority={task.priority} />
          </div>
          {showDueDate ? (
            <p className="mt-1 text-xs font-medium text-teal-800">
              Due {formatDisplayDate(task.due_date)}
            </p>
          ) : null}
          {task.content_preview ? (
            <p className="mt-1 line-clamp-2 text-sm text-slate-600">
              {task.content_preview}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
            {task.checklist_total > 0 ? (
              <span>
                Checklist {task.checklist_completed}/{task.checklist_total}
              </span>
            ) : null}
            {task.link_count > 0 ? <span>Links {task.link_count}</span> : null}
            {task.attachment_count > 0 ? (
              <span>Files {task.attachment_count}</span>
            ) : null}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => onEdit(task)}
              className="text-sm font-medium text-slate-600 hover:text-ink"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => onDelete(task)}
              className="text-sm font-medium text-rose-600 hover:text-rose-800"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
