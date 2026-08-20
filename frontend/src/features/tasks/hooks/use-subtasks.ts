"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { boardKeys, taskKeys } from "@/features/board/api/board-queries";
import type { BoardQueryParams, TaskDetail, TaskSubtask } from "@/features/board/types";

export function useSubtaskMutations(taskId: string, query: BoardQueryParams) {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
    await queryClient.invalidateQueries({ queryKey: boardKeys.view(query) });
  };

  const create = useMutation({
    mutationFn: (title: string) => apiClient.createSubtask(taskId, { title }),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({
      subtaskId,
      payload,
    }: {
      subtaskId: string;
      payload: { title?: string; is_completed?: boolean };
    }) => apiClient.updateSubtask(taskId, subtaskId, payload),
    onMutate: async ({ subtaskId, payload }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.detail(taskId) });
      const previous = queryClient.getQueryData<TaskDetail>(taskKeys.detail(taskId));
      if (previous) {
        queryClient.setQueryData<TaskDetail>(taskKeys.detail(taskId), {
          ...previous,
          subtasks: previous.subtasks.map((item) =>
            item.id === subtaskId ? { ...item, ...payload } : item,
          ),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(taskKeys.detail(taskId), context.previous);
      }
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (subtaskId: string) => apiClient.deleteSubtask(taskId, subtaskId),
    onSuccess: invalidate,
  });

  const reorder = useMutation({
    mutationFn: (payload: {
      subtask_id: string;
      before_subtask_id?: string | null;
      after_subtask_id?: string | null;
    }) => apiClient.reorderSubtasks(taskId, payload),
    onSuccess: (subtasks) => {
      queryClient.setQueryData<TaskDetail>(taskKeys.detail(taskId), (current) =>
        current ? { ...current, subtasks } : current,
      );
      void invalidate();
    },
  });

  return { create, update, remove, reorder };
}

export function subtaskProgressLabel(subtasks: TaskSubtask[]): string {
  const total = subtasks.length;
  const completed = subtasks.filter((item) => item.is_completed).length;
  return `${completed} of ${total} completed`;
}

export function canAddSubtask(title: string, isSaving: boolean): boolean {
  return Boolean(title.trim()) && !isSaving;
}
