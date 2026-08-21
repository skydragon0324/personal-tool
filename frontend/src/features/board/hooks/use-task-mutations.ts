"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { dashboardKeys } from "@/features/dashboard/hooks/use-dashboard";
import { recurrenceKeys } from "@/features/recurrence/api/recurrence-queries";
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

  function invalidateRelated() {
    void queryClient.invalidateQueries({ queryKey: key });
    void queryClient.invalidateQueries({ queryKey: todayKeys.all });
    void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    void queryClient.invalidateQueries({ queryKey: boardKeys.views(params.boardId) });
    void queryClient.invalidateQueries({ queryKey: recurrenceKeys.all });
  }

  const create = useMutation({
    mutationFn: (payload: TaskCreate) => taskMutations.create(payload),
    onSuccess: (task) => {
      const apply = options?.shouldApplyToView?.(task) ?? true;
      if (apply) {
        queryClient.setQueryData<BoardView>(key, (current) =>
          current ? applyDetailToView(current, task) : current,
        );
      }
      invalidateRelated();
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
      invalidateRelated();
    },
  });

  const remove = useMutation({
    mutationFn: ({
      taskId,
      deleteScope,
      confirmCompleted,
    }: {
      taskId: string;
      deleteScope?: string;
      confirmCompleted?: boolean;
    }) => taskMutations.remove(taskId, { deleteScope, confirmCompleted }),
    onSuccess: async () => {
      invalidateRelated();
    },
  });

  const stopRecurrence = useMutation({
    mutationFn: (seriesId: string) => taskMutations.stopRecurrence(seriesId),
    onSuccess: () => {
      invalidateRelated();
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

  return { create, update, remove, stopRecurrence, uploadAttachment, deleteAttachment };
}
