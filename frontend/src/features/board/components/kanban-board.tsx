"use client";

import { PointerActivationConstraints } from "@dnd-kit/dom";
import type { DragOverEvent } from "@dnd-kit/react";
import { DragDropProvider, KeyboardSensor, PointerSensor } from "@dnd-kit/react";
import { useCallback, useMemo } from "react";

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
  const sensors = useMemo(
    () => [
      PointerSensor.configure({
        activationConstraints: [
          new PointerActivationConstraints.Distance({ value: POINTER_ACTIVATION_DISTANCE }),
        ],
        preventActivation: (event) => isNoDragTarget(event.target),
      }),
      KeyboardSensor,
    ],
    [],
  );
  const { items, onDragStart, projectDrag, onDragEnd, resolveOverlayTask, moveTask } = useBoardDnd({
    query,
    columnIds,
    initialTasksByColumn: tasksByColumn,
  });

  const resolveTask = useCallback(
    (taskId: string) => resolveOverlayTask(taskId, tasksByColumn),
    [resolveOverlayTask, tasksByColumn],
  );

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

  function handleDragOver(event: DragOverEvent) {
    if (String(event.operation.source?.type ?? "") === "column") return;
    projectDrag(event);
  }

  return (
    <div className={`${BOARD_CONTENT_GUTTER} pb-8`}>
      <DragDropProvider
        sensors={sensors}
        onDragStart={(event) => {
          onDragStart(String(event.operation.source?.id ?? ""));
        }}
        onDragOver={handleDragOver}
        onDragEnd={(event) => {
          void onDragEnd(event);
        }}
      >
        <div className="flex h-[calc(100vh-16rem)] min-h-[28rem] gap-4 overflow-x-auto overflow-y-hidden">
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
        <TaskDragOverlay resolveTask={resolveTask} />
      </DragDropProvider>
    </div>
  );
}
