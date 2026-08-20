"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { todayKeys } from "@/features/today/api/today-queries";
import { applyDetailToView, boardKeys, taskKeys } from "../api/board-queries";
import { taskMutations } from "../api/task-mutations";
import type { BoardQueryParams, BoardView, TaskCreate, TaskDetail, TaskUpdate } from "../types";

export function useTaskMutations(
  params: BoardQueryParams,
  options?: { shouldApplyToView?: (task: TaskDetail) => boolean },
) {
  const queryClient = useQueryClient();
  const key = boardKeys.view(params);

  const create = useMutation({
    mutationFn: (payload: TaskCreate) => taskMutations.create(payload),
    onSuccess: (task) => {
      const apply = options?.shouldApplyToView?.(task) ?? true;
      if (apply) {
        queryClient.setQueryData<BoardView>(key, (current) =>
          current ? applyDetailToView(current, task) : current,
        );
      }
      void queryClient.invalidateQueries({ queryKey: key });
      void queryClient.invalidateQueries({ queryKey: todayKeys.all });
    },
  });

  const update = useMutation({
    mutationFn: ({
      taskId,
      payload,
    }: {
      taskId: string;
      payload: TaskUpdate;
    }) => taskMutations.update(taskId, payload),
    onSuccess: (task) => {
      queryClient.setQueryData(taskKeys.detail(task.id), task);
      const apply = options?.shouldApplyToView?.(task) ?? true;
      if (apply) {
        queryClient.setQueryData<BoardView>(key, (current) =>
          current ? applyDetailToView(current, task) : current,
        );
      }
      void queryClient.invalidateQueries({ queryKey: key });
      void queryClient.invalidateQueries({ queryKey: todayKeys.all });
    },
  });

  const remove = useMutation({
    mutationFn: (taskId: string) => taskMutations.remove(taskId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: key });
      await queryClient.invalidateQueries({ queryKey: todayKeys.all });
    },
  });

  const uploadAttachment = useMutation({
    mutationFn: ({ taskId, file }: { taskId: string; file: File }) =>
      apiClient.uploadAttachment(taskId, file),
    onSuccess: async (_data, vars) => {
      await queryClient.invalidateQueries({
        queryKey: taskKeys.detail(vars.taskId),
      });
      await queryClient.invalidateQueries({ queryKey: key });
    },
  });

  const deleteAttachment = useMutation({
    mutationFn: ({
      taskId,
      attachmentId,
    }: {
      taskId: string;
      attachmentId: string;
    }) => apiClient.deleteAttachment(taskId, attachmentId),
    onSuccess: async (_data, vars) => {
      await queryClient.invalidateQueries({
        queryKey: taskKeys.detail(vars.taskId),
      });
      await queryClient.invalidateQueries({ queryKey: key });
    },
  });

  return { create, update, remove, uploadAttachment, deleteAttachment };
}
