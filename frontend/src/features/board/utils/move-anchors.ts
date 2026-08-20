export function moveAnchors(
  visibleTasks: { id: string }[],
  movedId: string,
): { after_task_id: string | null; before_task_id: string | null } {
  const index = visibleTasks.findIndex((task) => task.id === movedId);
  if (index < 0) {
    return { after_task_id: null, before_task_id: null };
  }
  return {
    after_task_id: visibleTasks[index - 1]?.id ?? null,
    before_task_id: visibleTasks[index + 1]?.id ?? null,
  };
}

export function shouldShowDateHeadings(): boolean {
  return false;
}
