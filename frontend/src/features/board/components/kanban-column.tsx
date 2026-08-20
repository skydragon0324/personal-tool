"use client";

import { CollisionPriority } from "@dnd-kit/abstract";
import { useDroppable } from "@dnd-kit/react";

import type { BoardColumn, TaskSummary } from "../types";
import { statusHeaderClass, statusSoftClass } from "../utils/status-colors";
import { EmptyColumn } from "./empty-column";
import { TaskCard } from "./task-card";

interface KanbanColumnProps {
  column: BoardColumn;
  columns: BoardColumn[];
  tasks: TaskSummary[];
  onAdd: (columnId: string) => void;
  onOpenDetail: (task: TaskSummary, mode?: "view" | "edit") => void;
  onDelete: (task: TaskSummary) => void;
  onMoveStatus: (task: TaskSummary, columnId: string) => void;
}

export function KanbanColumn({
  column,
  columns,
  tasks,
  onAdd,
  onOpenDetail,
  onDelete,
  onMoveStatus,
}: KanbanColumnProps) {
  const { ref, isDropTarget } = useDroppable({
    id: column.id,
    type: "column",
    accept: "item",
    collisionPriority: CollisionPriority.Low,
  });

  return (
    <section
      className="flex flex-none flex-col overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)]"
      style={{ width: "20rem", minWidth: "20rem", maxWidth: "20rem" }}
    >
      <header
        className={`sticky top-0 z-10 flex items-center justify-between gap-2 px-3 py-3 text-white ${statusHeaderClass(column.color)}`}
      >
        <div>
          <h2 className="font-display text-lg leading-tight">{column.name}</h2>
          <p className="text-xs text-white/80">{tasks.length}</p>
        </div>
        <button
          type="button"
          onClick={() => onAdd(column.id)}
          className="rounded-lg bg-white/15 px-2.5 py-1 text-sm font-medium hover:bg-white/25"
        >
          Add
        </button>
      </header>
      <div
        ref={ref}
        className={`flex min-h-[12rem] flex-1 flex-col gap-3 overflow-y-auto p-3 ${statusSoftClass(column.color)} ${
          isDropTarget ? "bg-[var(--app-primary)]/10" : ""
        }`}
      >
        {tasks.length === 0 ? (
          <EmptyColumn />
        ) : (
          tasks.map((task, index) => (
            <TaskCard
              key={task.id}
              task={task}
              index={index}
              columnId={column.id}
              columns={columns}
              onOpenDetail={onOpenDetail}
              onDelete={onDelete}
              onMoveStatus={onMoveStatus}
            />
          ))
        )}
      </div>
    </section>
  );
}
