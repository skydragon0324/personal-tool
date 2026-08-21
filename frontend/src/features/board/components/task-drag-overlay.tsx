"use client";

import { createPortal } from "react-dom";
import { DragOverlay } from "@dnd-kit/react";

import type { TaskSummary } from "../types";
import { PriorityBadge } from "@/features/tasks/components/priority-badge";

export function overlayTaskFromSource(
  source: { id?: string | number } | null | undefined,
  resolveTask: (taskId: string) => TaskSummary | null,
): TaskSummary | null {
  if (source?.id == null || source.id === "") return null;
  return resolveTask(String(source.id));
}

export function TaskDragOverlay({
  resolveTask,
}: {
  resolveTask: (taskId: string) => TaskSummary | null;
}) {
  const overlay = (
    <DragOverlay className="pointer-events-none">
      {(source) => {
        const task = overlayTaskFromSource(source, resolveTask);
        if (!task) return null;
        return <OverlayCard task={task} />;
      }}
    </DragOverlay>
  );

  if (typeof document === "undefined") return overlay;
  return createPortal(overlay, document.body);
}

function OverlayCard({ task }: { task: TaskSummary }) {
  return (
    <div className="cursor-grabbing rounded-2xl border border-[var(--app-primary)] bg-[var(--app-surface)] p-3 shadow-2xl">
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 font-medium text-[var(--app-text)]">{task.title}</p>
        <PriorityBadge priority={task.priority} />
      </div>
    </div>
  );
}
