"use client";

import { move } from "@dnd-kit/helpers";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { ApiError } from "@/lib/api-client";
import { notifyApiError, notifyConflict } from "@/lib/notify";
import type { BoardQueryParams, TaskSummary, TasksByColumn } from "../types";
import { moveAnchors } from "../utils/move-anchors";
import { itemsByColumnIds, reindexColumnTasks } from "../utils/reorder-tasks";
import { useMoveTask } from "./use-move-task";

interface UseBoardDndArgs {
  query: BoardQueryParams;
  columnIds: string[];
  initialTasksByColumn: TasksByColumn;
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

  const onDragStart = useCallback(() => {
    dragging.current = true;
    snapshot.current = itemsRef.current;
  }, []);

  const onDragOver = useCallback(
    (event: Parameters<typeof move>[1]) => {
      setItems((current) => {
        const source = itemsByColumnIds(current, columnIds);
        const idMap: Record<string, string[]> = {};
        const taskLookup = new Map<string, TaskSummary>();
        for (const [columnId, tasks] of Object.entries(source)) {
          idMap[columnId] = tasks.map((task) => task.id);
          for (const task of tasks) taskLookup.set(task.id, task);
        }
        const nextIds = move(idMap, event) as Record<string, string[]>;
        const next: TasksByColumn = {};
        for (const columnId of columnIds) {
          const ids = nextIds[columnId] ?? [];
          next[columnId] = reindexColumnTasks(
            ids
              .map((id) => {
                const task = taskLookup.get(id);
                return task ? { ...task, column_id: columnId } : null;
              })
              .filter((task): task is TaskSummary => task !== null),
          );
        }
        itemsRef.current = next;
        return next;
      });
    },
    [columnIds],
  );

  const onDragEnd = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (event: any) => {
      dragging.current = false;
      if (event.canceled) {
        setItems(snapshot.current);
        itemsRef.current = snapshot.current;
        return;
      }

      const source = event.operation?.source;
      const sourceId = source?.id != null ? String(source.id) : "";
      if (!sourceId || source?.type === "column") return;

      let expectedVersion = 1;
      for (const list of Object.values(snapshot.current)) {
        const original = list.find((task) => task.id === sourceId);
        if (original) {
          expectedVersion = original.version;
          break;
        }
      }

      let targetColumnId: string | null = null;
      let targetList: TaskSummary[] = [];
      for (const [columnId, tasks] of Object.entries(itemsRef.current)) {
        if (tasks.some((task) => task.id === sourceId)) {
          targetColumnId = columnId;
          targetList = tasks;
          break;
        }
      }
      if (!targetColumnId) {
        setItems(snapshot.current);
        itemsRef.current = snapshot.current;
        return;
      }

      const anchors = moveAnchors(targetList, sourceId);
      let unchanged = false;
      for (const [columnId, tasks] of Object.entries(snapshot.current)) {
        const index = tasks.findIndex((task) => task.id === sourceId);
        if (index >= 0) {
          const currentIndex = targetList.findIndex((task) => task.id === sourceId);
          unchanged = columnId === targetColumnId && index === currentIndex;
          break;
        }
      }
      if (unchanged) return;

      try {
        await moveTask.mutateAsync({
          taskId: sourceId,
          payload: {
            target_column_id: targetColumnId,
            expected_version: expectedVersion,
            after_task_id: anchors.after_task_id,
            before_task_id: anchors.before_task_id,
          },
        });
      } catch (error) {
        setItems(snapshot.current);
        itemsRef.current = snapshot.current;
        if (error instanceof ApiError && error.status === 409) {
          notifyConflict();
          return;
        }
        notifyApiError(error, "Could not move the task");
      }
    },
    [moveTask],
  );

  return {
    items,
    onDragStart,
    onDragOver,
    onDragEnd,
    isPersisting: moveTask.isPending,
    moveTask,
  };
}
