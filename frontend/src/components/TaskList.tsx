"use client";

import type { Task } from "@/lib/types";
import { TaskItem } from "./TaskItem";

interface TaskListProps {
  tasks: Task[];
  loading: boolean;
  busyId: number | null;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

export function TaskList({
  tasks,
  loading,
  busyId,
  onToggle,
  onEdit,
  onDelete,
}: TaskListProps) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/50 px-4 py-10 text-center text-slate-500">
        Loading tasks…
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/50 px-4 py-10 text-center">
        <p className="font-display text-lg text-ink">No tasks yet</p>
        <p className="mt-1 text-sm text-slate-500">
          Add a task above or adjust your filters.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {tasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          busy={busyId === task.id}
          onToggle={onToggle}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}
