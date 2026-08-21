"use client";

import { move } from "@dnd-kit/helpers";
import type { DragEndEvent, DragOverEvent } from "@dnd-kit/react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { ApiError } from "@/lib/api-client";
import { notifyApiError, notifyConflict } from "@/lib/notify";
import type { BoardQueryParams, TaskSummary, TasksByColumn } from "../types";
import {
  applyMovedTaskVersion,
  buildMovePayload,
  collectionFromIdMap,
  collectionFromTargetFallback,
  collectionIdsEqual,
  entityFromDragValue,
  resolveOverlayTask as resolveOverlayTaskFromCollections,
} from "../utils/board-move";
import { itemsByColumnIds } from "../utils/reorder-tasks";
import { useMoveTask } from "./use-move-task";

interface UseBoardDndArgs {
  query: BoardQueryParams;
  columnIds: string[];
  initialTasksByColumn: TasksByColumn;
}

function pointFromOperation(operation: {
  position?: { current?: { x?: number; y?: number } };
  targetIdentifier?: string | number | null;
}): { x: number; y: number } | null {
  const current = operation.position?.current;
  if (typeof current?.x === "number" && typeof current?.y === "number") {
    return { x: current.x, y: current.y };
  }
  return null;
}

export function useBoardDnd({
  query,
  columnIds,
  initialTasksByColumn,
}: UseBoardDndArgs) {
  const syncedInitial = itemsByColumnIds(initialTasksByColumn, columnIds);
  const [items, setItems] = useState<TasksByColumn>(syncedInitial);
  const itemsRef = useRef(syncedInitial);
  const snapshot = useRef(syncedInitial);
  const sourceTaskId = useRef<string | null>(null);
  const sawDragOver = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const moveTask = useMoveTask(query);
  const columnKey = columnIds.join(",");

  useLayoutEffect(() => {
    if (dragging.current) return;
    const next = itemsByColumnIds(initialTasksByColumn, columnIds);
    setItems(next);
    itemsRef.current = next;
    snapshot.current = next;
  }, [initialTasksByColumn, columnKey, columnIds]);

  useLayoutEffect(() => {
    function onPointerMove(event: PointerEvent | MouseEvent) {
      if (!dragging.current) return;
      lastPoint.current = { x: event.clientX, y: event.clientY };
    }
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("mousemove", onPointerMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("mousemove", onPointerMove);
    };
  }, []);

  const onDragStart = useCallback((taskId: string) => {
    dragging.current = true;
    sawDragOver.current = false;
    lastPoint.current = null;
    sourceTaskId.current = taskId;
    snapshot.current = itemsRef.current;
  }, []);

  const projectDrag = useCallback(
    (event: DragOverEvent) => {
      const taskId = sourceTaskId.current ?? String(event.operation.source?.id ?? "");
      if (!taskId) return;

      const current = itemsByColumnIds(itemsRef.current, columnIds);
      const idMap: Record<string, string[]> = {};
      const taskLookup = new Map<string, TaskSummary>();
      for (const columnId of columnIds) {
        const tasks = current[columnId] ?? [];
        idMap[columnId] = tasks.map((task) => task.id);
        for (const task of tasks) taskLookup.set(task.id, task);
      }

      const nextIds = move(idMap, event) as Record<string, string[]>;
      let next = collectionFromIdMap(taskLookup, columnIds, nextIds);
      const target = entityFromDragValue(event.operation.target);
      lastPoint.current = pointFromOperation(event.operation) ?? lastPoint.current;

      if (target && collectionIdsEqual(next, current, columnIds)) {
        const fallback = collectionFromTargetFallback(
          snapshot.current,
          columnIds,
          taskId,
          target,
          {
            targetId: (event.operation as { targetIdentifier?: string | number | null })
              .targetIdentifier,
            point: lastPoint.current,
          },
        );
        if (fallback) next = fallback;
      }

      if (collectionIdsEqual(next, current, columnIds)) return;

      sawDragOver.current = true;
      itemsRef.current = next;
      setItems(next);
    },
    [columnIds],
  );

  const onDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const taskId = sourceTaskId.current ?? "";
      if (event.canceled || !taskId) {
        dragging.current = false;
        sourceTaskId.current = null;
        setItems(snapshot.current);
        itemsRef.current = snapshot.current;
        return;
      }

      let collection = itemsRef.current;
      if (!sawDragOver.current) {
        const operation = event.operation as {
          target?: unknown;
          targetIdentifier?: string | number | null;
          position?: { current?: { x?: number; y?: number } };
        };
        const fallback = collectionFromTargetFallback(
          snapshot.current,
          columnIds,
          taskId,
          entityFromDragValue(operation.target),
          {
            targetId: operation.targetIdentifier,
            point: lastPoint.current ?? pointFromOperation(operation),
          },
        );
        if (fallback) {
          collection = fallback;
        }
      }

      const payload = buildMovePayload(snapshot.current, collection, taskId);
      if (payload.unchanged || !payload.targetColumnId) {
        dragging.current = false;
        sourceTaskId.current = null;
        setItems(collection);
        itemsRef.current = collection;
        return;
      }

      setItems(collection);
      itemsRef.current = collection;

      try {
        const saved = await moveTask.mutateAsync({
          taskId: payload.taskId,
          payload: {
            target_column_id: payload.targetColumnId,
            expected_version: payload.expectedVersion,
            after_task_id: payload.afterTaskId,
            before_task_id: payload.beforeTaskId,
          },
        });
        const withVersion = applyMovedTaskVersion(collection, columnIds, saved);
        setItems(withVersion);
        itemsRef.current = withVersion;
      } catch (error) {
        setItems(snapshot.current);
        itemsRef.current = snapshot.current;
        if (error instanceof ApiError && error.status === 409) {
          notifyConflict();
          return;
        }
        notifyApiError(error, "Could not move the task");
      } finally {
        dragging.current = false;
        sourceTaskId.current = null;
      }
    },
    [columnIds, moveTask],
  );

  const resolveOverlayTask = useCallback(
    (taskId: string, initial?: TasksByColumn) =>
      resolveOverlayTaskFromCollections(
        taskId,
        snapshot.current,
        itemsRef.current,
        initial,
      ),
    [],
  );

  return {
    items,
    onDragStart,
    projectDrag,
    onDragOver: projectDrag,
    onDragEnd,
    resolveOverlayTask,
    isPersisting: moveTask.isPending,
    moveTask,
  };
}
