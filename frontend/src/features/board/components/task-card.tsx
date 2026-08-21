"use client";

import { useRef } from "react";
import { ActionIcon, Menu } from "@mantine/core";
import { useSortable } from "@dnd-kit/react/sortable";

import { CategoryBadge } from "@/features/tasks/components/category-badge";
import { PriorityBadge } from "@/features/tasks/components/priority-badge";
import { formatTaskPeriod, todayISO } from "@/lib/dates";
import type { BoardColumn, TaskSummary } from "../types";
import {
  POINTER_ACTIVATION_DISTANCE,
  isNoDragTarget,
  wasShortClick,
} from "../utils/pointer-activation";

interface TaskCardProps {
  task: TaskSummary;
  index: number;
  columnId: string;
  columns: BoardColumn[];
  onOpenDetail: (task: TaskSummary, mode?: "view" | "edit") => void;
  onDelete: (task: TaskSummary) => void;
  onMoveStatus: (task: TaskSummary, columnId: string) => void;
}

export function TaskCard({
  task,
  index,
  columnId,
  columns,
  onOpenDetail,
  onDelete,
  onMoveStatus,
}: TaskCardProps) {
  const { ref, isDragging } = useSortable({
    id: task.id,
    index,
    type: "item",
    accept: "item",
    group: columnId,
  });
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  const today = todayISO();
  const overdue = !task.completed_at && task.due_date < today;
  const dueToday = task.due_date === today;

  return (
    <article
      ref={ref}
      data-dragging={isDragging || undefined}
      className={`touch-none cursor-grab select-none rounded-2xl border bg-[var(--app-surface)] p-3 shadow-sm transition ${
        isDragging
          ? "cursor-grabbing scale-[1.02] opacity-40 shadow-xl"
          : "hover:shadow-md"
      } ${
        overdue
          ? "border-rose-400 dark:border-rose-500/70"
          : dueToday
            ? "border-[var(--app-primary)]"
            : "border-[var(--app-border)]"
      }`}
      onPointerDown={(event) => {
        if (isNoDragTarget(event.target)) {
          pointerStart.current = null;
          return;
        }
        pointerStart.current = { x: event.clientX, y: event.clientY };
      }}
      onClick={(event) => {
        if (isNoDragTarget(event.target)) return;
        if (
          !wasShortClick(
            pointerStart.current,
            { x: event.clientX, y: event.clientY },
            POINTER_ACTIVATION_DISTANCE,
          )
        ) {
          return;
        }
        onOpenDetail(task, "view");
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="min-w-0 flex-1 text-left font-medium text-[var(--app-text)]">
          <span className="line-clamp-2">{task.title}</span>
        </h2>
        <div data-no-dnd="true">
          <Menu shadow="md" position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" aria-label="Task menu">
                ⋯
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={() => onOpenDetail(task, "edit")}>Edit</Menu.Item>
              <Menu.Item color="red" onClick={() => onDelete(task)}>
                Delete
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {task.category ? <CategoryBadge category={task.category} /> : null}
        <PriorityBadge priority={task.priority} />
      </div>
      <p
        className={`mt-2 text-xs font-medium ${
          overdue
            ? "text-rose-600 dark:text-rose-300"
            : dueToday
              ? "text-[var(--app-primary)]"
              : "text-[var(--app-text-muted)]"
        }`}
      >
        {overdue ? "Overdue · " : dueToday ? "Due today · " : ""}
        {formatTaskPeriod(task.start_date, task.due_date)}
      </p>
      {task.content_preview ? (
        <p className="mt-1 line-clamp-2 text-sm text-[var(--app-text-muted)]">
          {task.content_preview}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--app-text-muted)]">
        {task.checklist_total > 0 ? (
          <span>
            Checklist {task.checklist_completed}/{task.checklist_total}
          </span>
        ) : null}
        {task.subtask_total > 0 ? (
          <span>
            Subtasks {task.subtask_completed}/{task.subtask_total}
          </span>
        ) : null}
        {task.link_count > 0 ? <span>Links {task.link_count}</span> : null}
        {task.attachment_count > 0 ? <span>Files {task.attachment_count}</span> : null}
      </div>
      <div data-no-dnd="true">
        <Menu shadow="md" position="bottom-start" withinPortal>
          <Menu.Target>
            <button
              type="button"
              className="mt-3 text-sm font-medium text-[var(--app-primary)] hover:underline"
            >
              Change status
            </button>
          </Menu.Target>
          <Menu.Dropdown>
            {columns.map((column) => (
              <Menu.Item
                key={column.id}
                disabled={column.id === task.column_id}
                onClick={() => onMoveStatus(task, column.id)}
              >
                {column.name}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      </div>
    </article>
  );
}
