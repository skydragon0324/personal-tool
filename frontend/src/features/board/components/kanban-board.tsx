"use client";

import { AutoScroller, PointerActivationConstraints } from "@dnd-kit/dom";
import { DragDropProvider, KeyboardSensor, PointerSensor } from "@dnd-kit/react";
import { useMemo, useState } from "react";

import { ApiError } from "@/lib/api-client";
import { notifyApiError, notifyConflict } from "@/lib/notify";
import type { BoardColumn, BoardQueryParams, TaskSummary, TasksByColumn } from "../types";
import { useBoardDnd } from "../hooks/use-board-dnd";
import { BOARD_CONTENT_GUTTER } from "../utils/board-layout";
import { POINTER_ACTIVATION_DISTANCE, isNoDragTarget } from "../utils/pointer-activation";
import { KanbanColumn } from "./kanban-column";
import { TaskDragOverlay } from "./task-drag-overlay";

interface KanbanBoardProps {
  query: BoardQueryParams;
  columns: BoardColumn[];
  tasksByColumn: TasksByColumn;
  onAdd: (columnId: string) => void;
  onOpenDetail: (task: TaskSummary, mode?: "view" | "edit") => void;
  onDelete: (task: TaskSummary) => void;
}

export function KanbanBoard({
  query,
  columns,
  tasksByColumn,
  onAdd,
  onOpenDetail,
  onDelete,
}: KanbanBoardProps) {
  const orderedColumns = useMemo(
    () => [...columns].sort((a, b) => a.position - b.position),
    [columns],
  );
  const columnIds = useMemo(
    () => orderedColumns.map((column) => column.id),
    [orderedColumns],
  );
  const pointerSensor = useMemo(
    () =>
      PointerSensor.configure({
        activationConstraints: [
          new PointerActivationConstraints.Distance({ value: POINTER_ACTIVATION_DISTANCE }),
        ],
        preventActivation: (event) => isNoDragTarget(event.target),
      }),
    [],
  );
  const { items, onDragStart, onDragOver, onDragEnd, moveTask } = useBoardDnd({
    query,
    columnIds,
    initialTasksByColumn: tasksByColumn,
  });
  const [activeTask, setActiveTask] = useState<TaskSummary | null>(null);

  async function handleMoveStatus(task: TaskSummary, columnId: string) {
    if (columnId === task.column_id) return;
    try {
      await moveTask.mutateAsync({
        taskId: task.id,
        payload: {
          target_column_id: columnId,
          expected_version: task.version,
        },
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        notifyConflict();
        return;
      }
      notifyApiError(error, "Could not change status");
    }
  }

  return (
    <div className={`${BOARD_CONTENT_GUTTER} pb-8`}>
      <DragDropProvider
        sensors={[pointerSensor, KeyboardSensor]}
        plugins={[AutoScroller.configure({ threshold: { x: 0.12, y: 0.2 } })]}
        onDragStart={(event) => {
          onDragStart();
          const id = String(event.operation.source?.id ?? "");
          const task =
            Object.values(items)
              .flat()
              .find((item) => item.id === id) ?? null;
          setActiveTask(task);
        }}
        onDragOver={(event) => {
          const source = event.operation.source;
          if (source?.type === "column") return;
          onDragOver(event);
        }}
        onDragEnd={async (event) => {
          setActiveTask(null);
          await onDragEnd(event);
        }}
      >
        <div
          className="flex h-[calc(100vh-16rem)] min-h-[28rem] gap-4 overflow-x-auto overflow-y-hidden"
        >
          {orderedColumns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              columns={orderedColumns}
              tasks={items[column.id] ?? []}
              onAdd={onAdd}
              onOpenDetail={onOpenDetail}
              onDelete={onDelete}
              onMoveStatus={(task, columnId) => void handleMoveStatus(task, columnId)}
            />
          ))}
        </div>
        <TaskDragOverlay task={activeTask} />
      </DragDropProvider>
    </div>
  );
}
