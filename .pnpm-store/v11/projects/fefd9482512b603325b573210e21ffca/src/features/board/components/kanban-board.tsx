"use client";

import { DragDropProvider, KeyboardSensor, PointerSensor } from "@dnd-kit/react";
import { useMemo, useState } from "react";

import type { BoardColumn, TaskSummary, TasksByColumn } from "../types";
import { useBoardDnd } from "../hooks/use-board-dnd";
import { KanbanColumn } from "./kanban-column";
import { TaskDragOverlay } from "./task-drag-overlay";

interface KanbanBoardProps {
  boardId: string;
  startDate: string;
  endDate: string;
  columns: BoardColumn[];
  tasksByColumn: TasksByColumn;
  onAdd: (columnId: string) => void;
  onEdit: (task: TaskSummary) => void;
  onDelete: (task: TaskSummary) => void;
}

export function KanbanBoard({
  boardId,
  startDate,
  endDate,
  columns,
  tasksByColumn,
  onAdd,
  onEdit,
  onDelete,
}: KanbanBoardProps) {
  const dragEnabled = startDate === endDate;
  const multiDay = !dragEnabled;
  const { items, onDragStart, onDragOver, onDragEnd } = useBoardDnd({
    boardId,
    startDate,
    endDate,
    initialTasksByColumn: tasksByColumn,
    enabled: dragEnabled,
  });
  const [activeTask, setActiveTask] = useState<TaskSummary | null>(null);

  const orderedColumns = useMemo(
    () => [...columns].sort((a, b) => a.position - b.position),
    [columns],
  );

  return (
    <div>
      {multiDay ? (
        <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          기간 보기에서는 순서 변경을 할 수 없습니다. 하루만 선택하면 드래그로 정렬할 수
          있습니다.
        </p>
      ) : null}
      <DragDropProvider
        sensors={[PointerSensor, KeyboardSensor]}
        onDragStart={(event) => {
          if (!dragEnabled) return;
          onDragStart();
          const id = String(event.operation.source?.id ?? "");
          const task =
            Object.values(items)
              .flat()
              .find((t) => t.id === id) ?? null;
          setActiveTask(task);
        }}
        onDragOver={(event) => {
          if (!dragEnabled) return;
          const source = event.operation.source;
          if (source?.type === "column") return;
          onDragOver(event);
        }}
        onDragEnd={async (event) => {
          setActiveTask(null);
          if (!dragEnabled) return;
          await onDragEnd(event);
        }}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {orderedColumns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              tasks={items[column.id] ?? []}
              dragEnabled={dragEnabled}
              multiDay={multiDay}
              onAdd={onAdd}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
        <TaskDragOverlay task={activeTask} />
      </DragDropProvider>
    </div>
  );
}
