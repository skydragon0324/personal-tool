"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ApiError } from "@/lib/api-client";
import { boardKeys } from "../api/board-queries";
import { taskMutations } from "../api/task-mutations";
import type { BoardView, TaskMove, TaskSummary } from "../types";

export function useMoveTask(
  boardId: string,
  startDate: string,
  endDate: string,
) {
  const queryClient = useQueryClient();
  const key = boardKeys.view(boardId, startDate, endDate);

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
        const moving = previous.columns
          .flatMap((c) => c.tasks)
          .find((t) => t.id === taskId);
        if (moving) {
          const columns = previous.columns.map((column) => {
            let tasks = column.tasks.filter((t) => t.id !== taskId);
            if (column.id === moving.column_id) {
              tasks = tasks
                .filter((t) => t.due_date === moving.due_date)
                .map((t) =>
                  t.position > moving.position
                    ? { ...t, position: t.position - 1 }
                    : t,
                )
                .concat(
                  column.tasks.filter(
                    (t) => t.id !== taskId && t.due_date !== moving.due_date,
                  ),
                )
                .sort((a, b) => {
                  if (a.due_date !== b.due_date)
                    return a.due_date.localeCompare(b.due_date);
                  return a.position - b.position;
                });
            }
            if (column.id === payload.target_column_id) {
              const sameDay = tasks.filter((t) => t.due_date === moving.due_date);
              const otherDays = tasks.filter((t) => t.due_date !== moving.due_date);
              const shifted = sameDay.map((t) =>
                t.position >= payload.target_position
                  ? { ...t, position: t.position + 1 }
                  : t,
              );
              const optimistic: TaskSummary = {
                ...moving,
                column_id: payload.target_column_id,
                position: payload.target_position,
                version: moving.version + 1,
                completed_at: column.is_done
                  ? moving.completed_at ?? new Date().toISOString()
                  : null,
              };
              tasks = [...otherDays, ...shifted, optimistic].sort((a, b) => {
                if (a.due_date !== b.due_date)
                  return a.due_date.localeCompare(b.due_date);
                return a.position - b.position;
              });
            }
            return { ...column, tasks };
          });
          const all = columns.flatMap((c) => c.tasks);
          const doneIds = new Set(
            columns.filter((c) => c.is_done).map((c) => c.id),
          );
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
