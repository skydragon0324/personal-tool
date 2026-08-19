"use client";

import { DragOverlay } from "@dnd-kit/react";

import type { TaskSummary } from "../types";
import { PriorityBadge } from "@/features/tasks/components/priority-badge";

export function TaskDragOverlay({ task }: { task: TaskSummary | null }) {
  return (
    <DragOverlay>
      {task ? (
        <div className="w-72 rounded-2xl border border-teal-200 bg-white p-3 shadow-xl">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-ink">{task.title}</p>
            <PriorityBadge priority={task.priority} />
          </div>
        </div>
      ) : null}
    </DragOverlay>
  );
}
