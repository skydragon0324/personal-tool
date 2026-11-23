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
import { CalendarIcon, DotsIcon, PersonIcon, ProgressMark } from "./board-ui-icons";
import { t } from "@/i18n";

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
  const done = Boolean(task.completed_at);
  const stepsTotal = task.checklist_total + task.subtask_total;
  const started = columns.findIndex((column) => column.id === columnId) > 0;
  // Real step progress when the task has steps; otherwise a small arc once it has left the first status.
  const progress = stepsTotal
    ? (task.checklist_completed + task.subtask_completed) / stepsTotal
    : started
      ? 0.25
      : 0;
  const hasDetails =
    task.checklist_total > 0 || task.subtask_total > 0 || task.link_count > 0 || task.attachment_count > 0;

  return (
    <article
      ref={ref}
      data-dragging={isDragging || undefined}
      className={`touch-none cursor-grab select-none rounded-2xl border bg-[var(--app-surface)] px-3.5 py-3 shadow-[0_4px_14px_rgba(31,55,50,0.06)] transition ${
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
      <div className="flex items-center justify-between gap-1.5">
        <div className="min-w-0 flex-1">
          {task.category ? <CategoryBadge category={task.category} /> : null}
        </div>
        <PriorityBadge priority={task.priority} />
        <div data-no-dnd="true" className="-mr-1 shrink-0">
          <Menu shadow="md" position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" size="sm" aria-label={t("task.menu")}>
                <DotsIcon size={15} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={() => onOpenDetail(task, "edit")}>{t("common.edit")}</Menu.Item>
              {onDuplicate ? <Menu.Item onClick={() => onDuplicate(task)}>{t("task.duplicate")}</Menu.Item> : null}
              {onMoveToBoard ? (
                <Menu.Item onClick={() => onMoveToBoard(task)}>{t("task.moveToBoard")}</Menu.Item>
              ) : null}
              {columns.length > 1 ? (
                <>
                  <Menu.Divider />
                  <Menu.Label>{t("task.changeStatus")}</Menu.Label>
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
                  <Menu.Label>{t("task.assignTo")}</Menu.Label>
                  {/* Long member lists scroll instead of stretching the menu off the screen. */}
                  <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: "min(15rem, 40vh)" }}>
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
                  </div>
                  {task.assignees?.length ? (
                    <Menu.Item onClick={() => onAssign(task, [])}>{t("task.unassignEveryone")}</Menu.Item>
                  ) : null}
                </>
              ) : null}
              <Menu.Divider />
              <Menu.Item color="red" onClick={() => onDelete(task)}>
                {t("common.delete")}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </div>
      </div>
      <h2
        className={`mt-2 text-left font-display text-[1.05rem] font-semibold leading-snug text-[var(--app-text)] ${
          done ? "line-through decoration-[var(--app-text-muted)]" : ""
        }`}
      >
        <span className="line-clamp-2">{task.title}</span>
      </h2>
      {task.content_preview ? (
        <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-[var(--app-text-muted)]">
          {task.content_preview}
        </p>
      ) : null}
      {hasDetails ? (
        <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-[var(--app-text-muted)]">
          {task.checklist_total > 0 ? (
            <span>
              {t("task.checklistCount", { done: task.checklist_completed, total: task.checklist_total })}
            </span>
          ) : null}
          {task.subtask_total > 0 ? (
            <span>
              {t("task.subtasksCount", { done: task.subtask_completed, total: task.subtask_total })}
            </span>
          ) : null}
          {task.link_count > 0 ? <span>{t("task.linksCount", { count: task.link_count })}</span> : null}
          {task.attachment_count > 0 ? <span>{t("task.filesCount", { count: task.attachment_count })}</span> : null}
        </div>
      ) : null}
      <div className="mt-2.5 flex items-center gap-2 text-xs text-[var(--app-text-muted)]">
        <CalendarIcon size={15} className="shrink-0" />
        <span
          className={`min-w-0 font-medium ${
            overdue
              ? "text-rose-600 dark:text-rose-300"
              : dueToday
                ? "text-[var(--app-primary)]"
                : ""
          }`}
        >
          {overdue ? t("task.overduePrefix") : dueToday ? t("task.dueTodayPrefix") : ""}
          {formatTaskPeriod(task.start_date, task.due_date)}
        </span>
        <span className="ml-1">
          <ProgressMark done={done} progress={progress} />
        </span>
        <div className="ml-auto shrink-0">
          {task.assignees?.length ? (
            <AssigneeAvatars people={task.assignees} size={28} max={3} />
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--app-surface-muted)]">
              <PersonIcon size={15} />
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
