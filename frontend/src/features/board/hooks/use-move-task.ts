"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ApiError } from "@/lib/api-client";
import { boardKeys } from "../api/board-queries";
import { taskMutations } from "../api/task-mutations";
import type { BoardQueryParams, BoardView, TaskMove, TaskSummary } from "../types";

function insertAt(tasks: TaskSummary[], task: TaskSummary, index: number): TaskSummary[] {
  const next = [...tasks];
  next.splice(index, 0, task);
  return next.map((item, position) => ({ ...item, position }));
}

export function useMoveTask(params: BoardQueryParams) {
  const queryClient = useQueryClient();
  const key = boardKeys.view(params);

  return useMutation({
    mutationFn: ({
      taskId,
      payload,
    }: {
      taskId: string;
      payload: TaskMove;
    }) => taskMutations.move(taskId, payload),
    onMutate: async ({ taskId, payload }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<BoardView>(key);

      if (previous) {
        const moving = previous.columns.flatMap((c) => c.tasks).find((t) => t.id === taskId);
        if (moving) {
          const columns = previous.columns.map((column) => {
            let tasks = column.tasks.filter((t) => t.id !== taskId);
            if (column.id === payload.target_column_id) {
              const siblingIds = tasks.map((t) => t.id);
              let index = siblingIds.length;
              if (payload.after_task_id) {
                const after = siblingIds.indexOf(payload.after_task_id);
                index = after >= 0 ? after + 1 : index;
              } else if (payload.before_task_id) {
                const before = siblingIds.indexOf(payload.before_task_id);
                index = before >= 0 ? before : 0;
              } else if (payload.target_position != null) {
                index = Math.min(payload.target_position, siblingIds.length);
              }
              const optimistic: TaskSummary = {
                ...moving,
                column_id: payload.target_column_id,
                position: index,
                version: moving.version + 1,
                completed_at: column.is_done
                  ? moving.completed_at ?? new Date().toISOString()
                  : null,
              };
              tasks = insertAt(tasks, optimistic, index);
            } else {
              tasks = tasks.map((item, position) => ({ ...item, position }));
            }
            return { ...column, tasks };
          });
          const all = columns.flatMap((c) => c.tasks);
          const doneIds = new Set(columns.filter((c) => c.is_done).map((c) => c.id));
          const completed = all.filter((t) => doneIds.has(t.column_id)).length;
          queryClient.setQueryData<BoardView>(key, {
            ...previous,
            columns,
            summary: {
              total: all.length,
              completed,
              remaining: all.length - completed,
            },
          });
        }
      }

      return { previous };
    },
    onError: async (error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(key, context.previous);
      }
      if (error instanceof ApiError && error.status === 409) {
        await queryClient.invalidateQueries({ queryKey: key });
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
