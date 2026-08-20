"use client";

import { DragOverlay } from "@dnd-kit/react";

import type { TaskSummary } from "../types";
import { PriorityBadge } from "@/features/tasks/components/priority-badge";

export function TaskDragOverlay({ task }: { task: TaskSummary | null }) {
  return (
    <DragOverlay>
      {task ? (
        <div className="w-72 cursor-grabbing rounded-2xl border border-[var(--app-primary)] bg-[var(--app-surface)] p-3 shadow-2xl scale-[1.03]">
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-2 font-medium text-[var(--app-text)]">{task.title}</p>
            <PriorityBadge priority={task.priority} />
          </div>
        </div>
      ) : null}
    </DragOverlay>
  );
}
