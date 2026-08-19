"use client";

import { move } from "@dnd-kit/helpers";
import { useCallback, useEffect, useRef, useState } from "react";

import type { TaskSummary, TasksByColumn } from "../types";
import { reindexColumnTasks } from "../utils/reorder-tasks";
import { useMoveTask } from "./use-move-task";

interface UseBoardDndArgs {
  boardId: string;
  startDate: string;
  endDate: string;
  initialTasksByColumn: TasksByColumn;
  enabled: boolean;
}

export function useBoardDnd({
  boardId,
  startDate,
  endDate,
  initialTasksByColumn,
  enabled,
}: UseBoardDndArgs) {
  const [items, setItems] = useState<TasksByColumn>(initialTasksByColumn);
  const itemsRef = useRef(items);
  const snapshot = useRef<TasksByColumn>(initialTasksByColumn);
  const moveTask = useMoveTask(boardId, startDate, endDate);

  useEffect(() => {
    setItems(initialTasksByColumn);
    itemsRef.current = initialTasksByColumn;
  }, [initialTasksByColumn]);

  const onDragStart = useCallback(() => {
    if (!enabled) return;
    snapshot.current = itemsRef.current;
  }, [enabled]);

  const onDragOver = useCallback(
    (event: Parameters<typeof move>[1]) => {
      if (!enabled) return;
      setItems((current) => {
        const idMap: Record<string, string[]> = {};
        const taskLookup = new Map<string, TaskSummary>();
        for (const [columnId, tasks] of Object.entries(current)) {
          idMap[columnId] = tasks.map((t) => t.id);
          for (const task of tasks) taskLookup.set(task.id, task);
        }

        const nextIds = move(idMap, event) as Record<string, string[]>;
        const next: TasksByColumn = {};
        for (const [columnId, ids] of Object.entries(nextIds)) {
          next[columnId] = reindexColumnTasks(
            ids
              .map((id) => {
                const task = taskLookup.get(id);
                return task ? { ...task, column_id: columnId } : null;
              })
              .filter((t): t is TaskSummary => t !== null),
          );
        }
        itemsRef.current = next;
        return next;
      });
    },
    [enabled],
  );

  const onDragEnd = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (event: any) => {
      if (!enabled) return;
      if (event.canceled) {
        setItems(snapshot.current);
        itemsRef.current = snapshot.current;
        return;
      }

      const source = event.operation?.source;
      const sourceId = source?.id != null ? String(source.id) : "";
      if (!sourceId || source?.type === "column") return;

      const current = itemsRef.current;
      let targetColumnId: string | null = null;
      let targetPosition = 0;
      let expectedVersion = 1;

      for (const list of Object.values(snapshot.current)) {
        const original = list.find((t) => t.id === sourceId);
        if (original) {
          expectedVersion = original.version;
          break;
        }
      }

      for (const [columnId, tasks] of Object.entries(current)) {
        const index = tasks.findIndex((t) => t.id === sourceId);
        if (index >= 0) {
          targetColumnId = columnId;
          targetPosition = index;
          break;
        }
      }

      if (!targetColumnId) {
        setItems(snapshot.current);
        itemsRef.current = snapshot.current;
        return;
      }

      let unchanged = false;
      for (const [columnId, tasks] of Object.entries(snapshot.current)) {
        const index = tasks.findIndex((t) => t.id === sourceId);
        if (index >= 0) {
          unchanged = columnId === targetColumnId && index === targetPosition;
          break;
        }
      }
      if (unchanged) return;

      try {
        await moveTask.mutateAsync({
          taskId: sourceId,
          payload: {
            target_column_id: targetColumnId,
            target_position: targetPosition,
            expected_version: expectedVersion,
          },
        });
      } catch {
        setItems(snapshot.current);
        itemsRef.current = snapshot.current;
      }
    },
    [enabled, moveTask],
  );

  return {
    items,
    setItems,
    onDragStart,
    onDragOver,
    onDragEnd,
    isPersisting: moveTask.isPending,
  };
}
