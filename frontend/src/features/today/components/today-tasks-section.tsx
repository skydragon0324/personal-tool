"use client";

import { BoardGlyph, boardColorClass } from "@/features/board/utils/board-icons";
import { statusHeaderClass } from "@/features/board/utils/status-colors";
import { PriorityBadge } from "@/features/tasks/components/priority-badge";
import { formatTaskPeriod } from "@/lib/dates";
import { DashboardPanel, PanelEmpty } from "@/features/shell/components/dashboard-panel";
import { NavIcon } from "@/features/shell/components/nav-icons";

import type { TodayTask } from "../types";
import { DEADLINE_STATUS_LABEL } from "../utils/labels";

export function TodayTasksSection({
  title,
  description,
  emptyText,
  emptyActionHref,
  emptyActionLabel,
  icon,
  tasks,
  onOpen,
}: {
  title: string;
  description: string;
  emptyText: string;
  emptyActionHref?: string;
  emptyActionLabel?: string;
  icon?: "boards" | "today";
  tasks: TodayTask[];
  onOpen: (task: TodayTask) => void;
}) {
  return (
    <DashboardPanel
      title={title}
      description={description}
      icon={<NavIcon name={icon ?? "boards"} />}
      count={tasks.length}
      actionHref={emptyActionHref}
      actionLabel={emptyActionLabel}
      empty={tasks.length === 0 ? <PanelEmpty>{emptyText}</PanelEmpty> : undefined}
    >
      <ul className="space-y-1">
        {tasks.map((task) => {
          const completed = Boolean(task.completed_at) || task.status_is_done;
          return (
            <li key={task.id}>
              <button
                type="button"
                onClick={() => onOpen(task)}
                className={`flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-[var(--app-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--app-primary)] ${
                  completed ? "opacity-55" : ""
                }`}
              >
                <span
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white ${boardColorClass(task.board_color)}`}
                  title={task.board_name}
                >
                  <BoardGlyph name={task.board_icon_name} size={13} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-[var(--app-text)]">{task.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--app-text-muted)]">
                    <span className="truncate">{task.board_name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 font-medium text-white ${statusHeaderClass(task.status_color)}`}
                    >
                      {task.status_name}
                    </span>
                    <PriorityBadge priority={task.priority} />
                    <span>{DEADLINE_STATUS_LABEL[task.deadline_status]}</span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--app-text-muted)]">
                    {formatTaskPeriod(task.start_date, task.due_date)}
                  </p>
                  {task.subtask_total > 0 ? (
                    <p className="mt-1 text-xs text-[var(--app-text-muted)]">
                      Subtasks {task.subtask_completed}/{task.subtask_total}
                    </p>
                  ) : null}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </DashboardPanel>
  );
}
