"use client";

import { useRef } from "react";
import { ActionIcon, Menu } from "@mantine/core";
import { useSortable } from "@dnd-kit/react/sortable";

import { CategoryBadge } from "@/features/tasks/components/category-badge";
import { PriorityBadge } from "@/features/tasks/components/priority-badge";
import { formatTaskPeriod, todayISO } from "@/lib/dates";
import type { BoardColumn, BoardPerson, TaskSummary } from "../types";
import {
  POINTER_ACTIVATION_DISTANCE,
  isNoDragTarget,
  wasShortClick,
} from "../utils/pointer-activation";
import { AssigneeAvatars } from "./assignee-avatars";

interface TaskCardProps {
  task: TaskSummary;
  index: number;
  columnId: string;
  columns: BoardColumn[];
  onOpenDetail: (task: TaskSummary, mode?: "view" | "edit") => void;
  onDelete: (task: TaskSummary) => void;
  onMoveStatus: (task: TaskSummary, columnId: string) => void;
  people?: BoardPerson[];
  /** Replace the task's assignees with `userIds`. */
  onAssign?: (task: TaskSummary, userIds: string[]) => void;
  onDuplicate?: (task: TaskSummary) => void;
  onMoveToBoard?: (task: TaskSummary) => void;
}

export function TaskCard({
  task,
  index,
  columnId,
  columns,
  onOpenDetail,
  onDelete,
  onMoveStatus,
  people = [],
  onAssign,
  onDuplicate,
  onMoveToBoard,
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
      className={`touch-none cursor-grab select-none rounded-xl border bg-[var(--app-surface)] px-2.5 py-2 shadow-sm transition ${
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
      <div className="flex items-start justify-between gap-1">
        <h2 className="min-w-0 flex-1 text-left text-sm font-medium leading-snug text-[var(--app-text)]">
          <span className="line-clamp-2">{task.title}</span>
        </h2>
        {task.assignees?.length ? (
          <div className="shrink-0">
            <AssigneeAvatars people={task.assignees} size={22} max={3} />
          </div>
        ) : null}
        <div data-no-dnd="true" className="-mr-1 -mt-0.5 shrink-0">
          <Menu shadow="md" position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" size="sm" aria-label="Task menu">
                ⋯
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={() => onOpenDetail(task, "edit")}>Edit</Menu.Item>
              {onDuplicate ? <Menu.Item onClick={() => onDuplicate(task)}>Duplicate</Menu.Item> : null}
              {onMoveToBoard ? (
                <Menu.Item onClick={() => onMoveToBoard(task)}>Move to board…</Menu.Item>
              ) : null}
              {columns.length > 1 ? (
                <>
                  <Menu.Divider />
                  <Menu.Label>Change status</Menu.Label>
                  {columns.map((column) => (
                    <Menu.Item
                      key={column.id}
                      disabled={column.id === task.column_id}
                      onClick={() => onMoveStatus(task, column.id)}
                    >
                      {column.name}
                    </Menu.Item>
                  ))}
                </>
              ) : null}
              {onAssign && people.length ? (
                <>
                  <Menu.Divider />
                  <Menu.Label>Assign to</Menu.Label>
                  {people.map((person) => {
                    const ids = (task.assignees ?? []).map((item) => item.id);
                    const assigned = ids.includes(person.user_id);
                    return (
                      <Menu.Item
                        key={person.user_id}
                        closeMenuOnClick={false}
                        onClick={() =>
                          onAssign(
                            task,
                            assigned ? ids.filter((id) => id !== person.user_id) : [...ids, person.user_id],
                          )
                        }
                        rightSection={assigned ? "✓" : null}
                      >
                        {person.display_name}
                      </Menu.Item>
                    );
                  })}
                  {task.assignees?.length ? (
                    <Menu.Item onClick={() => onAssign(task, [])}>Unassign everyone</Menu.Item>
                  ) : null}
                </>
              ) : null}
              <Menu.Divider />
              <Menu.Item color="red" onClick={() => onDelete(task)}>
                Delete
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[var(--app-text-muted)]">
        {task.category ? <CategoryBadge category={task.category} /> : null}
        <PriorityBadge priority={task.priority} />
        <span
          className={`font-medium ${
            overdue
              ? "text-rose-600 dark:text-rose-300"
              : dueToday
                ? "text-[var(--app-primary)]"
                : ""
          }`}
        >
          {overdue ? "Overdue · " : dueToday ? "Due today · " : ""}
          {formatTaskPeriod(task.start_date, task.due_date)}
        </span>
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
    </article>
  );
}
