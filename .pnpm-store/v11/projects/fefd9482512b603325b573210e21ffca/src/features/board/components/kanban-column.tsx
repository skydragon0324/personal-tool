"use client";

import { CollisionPriority } from "@dnd-kit/abstract";
import { useDroppable } from "@dnd-kit/react";

import { formatDisplayDate } from "@/lib/dates";
import type { BoardColumn, TaskSummary } from "../types";
import { EmptyColumn } from "./empty-column";
import { TaskCard } from "./task-card";

interface KanbanColumnProps {
  column: BoardColumn;
  tasks: TaskSummary[];
  dragEnabled: boolean;
  multiDay: boolean;
  onAdd: (columnId: string) => void;
  onEdit: (task: TaskSummary) => void;
  onDelete: (task: TaskSummary) => void;
}

function groupByDueDate(tasks: TaskSummary[]): [string, TaskSummary[]][] {
  const map = new Map<string, TaskSummary[]>();
  for (const task of tasks) {
    const list = map.get(task.due_date) ?? [];
    list.push(task);
    map.set(task.due_date, list);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export function KanbanColumn({
  column,
  tasks,
  dragEnabled,
  multiDay,
  onAdd,
  onEdit,
  onDelete,
}: KanbanColumnProps) {
  const { ref, isDropTarget } = useDroppable({
    id: column.id,
    type: "column",
    accept: "item",
    collisionPriority: CollisionPriority.Low,
    disabled: !dragEnabled,
  });

  const groups = multiDay ? groupByDueDate(tasks) : [["", tasks] as [string, TaskSummary[]]];

  return (
    <section
      ref={ref}
      className={`flex w-[min(85vw,20rem)] shrink-0 flex-col rounded-2xl border p-3 ${
        isDropTarget
          ? "border-teal-400 bg-teal-50/70"
          : "border-slate-200/80 bg-white/70"
      }`}
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-lg text-ink">{column.name}</h2>
          <p className="text-xs text-slate-500">{tasks.length} tasks</p>
        </div>
        <button
          type="button"
          onClick={() => onAdd(column.id)}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-sm font-medium text-teal-800 hover:bg-slate-50"
        >
          Add
        </button>
      </header>
      <div className="flex min-h-[12rem] flex-1 flex-col gap-3">
        {tasks.length === 0 ? (
          <EmptyColumn />
        ) : (
          groups.map(([dueDate, groupTasks]) => (
            <div key={dueDate || "single"} className="space-y-2">
              {multiDay && dueDate ? (
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {formatDisplayDate(dueDate)}
                </p>
              ) : null}
              {groupTasks.map((task, index) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  index={multiDay ? index : tasks.findIndex((t) => t.id === task.id)}
                  columnId={column.id}
                  showDueDate={multiDay}
                  dragEnabled={dragEnabled}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
