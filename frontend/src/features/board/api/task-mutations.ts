import { apiClient } from "@/lib/api-client";
import type { TaskCreate, TaskMove, TaskUpdate } from "../types";

export const taskMutations = {
  create: (payload: TaskCreate) => apiClient.createTask(payload),
  update: (taskId: string, payload: TaskUpdate) =>
    apiClient.updateTask(taskId, payload),
  move: (taskId: string, payload: TaskMove) => apiClient.moveTask(taskId, payload),
  remove: (
    taskId: string,
    options?: { deleteScope?: string; confirmCompleted?: boolean },
  ) => apiClient.deleteTask(taskId, options),
  stopRecurrence: (seriesId: string) => apiClient.stopRecurrence(seriesId),
};
