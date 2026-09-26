/**
 * Asks an already-mounted board page to open a task drawer. Used when navigating to
 * `/boards/{id}?task=…` would not remount the page because that board is already open.
 */
export const OPEN_TASK_EVENT = "life-management:open-task";

export interface OpenTaskDetail {
  boardId: string;
  taskId: string;
}

export function dispatchOpenTask(detail: OpenTaskDetail): void {
  window.dispatchEvent(new CustomEvent<OpenTaskDetail>(OPEN_TASK_EVENT, { detail }));
}
