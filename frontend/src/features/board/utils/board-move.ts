import type { TaskSummary, TasksByColumn } from "../types";
import { moveAnchors } from "./move-anchors";
import { itemsByColumnIds, reindexColumnTasks } from "./reorder-tasks";

export interface BoardDragEntity {
  id?: string | number;
  type?: string;
  index?: number;
  group?: string | number;
  initialGroup?: string | number;
  initialIndex?: number;
}

export function entityFromDragValue(value: unknown): BoardDragEntity | null {
  if (!value || typeof value !== "object") return null;
  const record = value as BoardDragEntity;
  return {
    id: record.id,
    type: record.type != null ? String(record.type) : undefined,
    index: typeof record.index === "number" ? record.index : undefined,
    group: record.group,
    initialGroup: record.initialGroup,
    initialIndex: typeof record.initialIndex === "number" ? record.initialIndex : undefined,
  };
}

export interface TaskLocation {
  columnId: string;
  index: number;
  task: TaskSummary;
}

export interface BoardMovePayload {
  unchanged: boolean;
  taskId: string;
  targetColumnId: string | null;
  expectedVersion: number;
  afterTaskId: string | null;
  beforeTaskId: string | null;
}

export function findTaskLocation(
  collection: TasksByColumn,
  taskId: string,
): TaskLocation | null {
  for (const [columnId, tasks] of Object.entries(collection)) {
    const index = tasks.findIndex((task) => task.id === taskId);
    if (index >= 0) return { columnId, index, task: tasks[index] };
  }
  return null;
}

export function resolveOverlayTask(
  taskId: string,
  snapshot: TasksByColumn,
  projected: TasksByColumn,
  initial?: TasksByColumn,
): TaskSummary | null {
  if (!taskId) return null;
  return (
    findTaskLocation(snapshot, taskId)?.task ??
    findTaskLocation(projected, taskId)?.task ??
    (initial ? findTaskLocation(initial, taskId)?.task : null) ??
    null
  );
}

export function collectionIdsEqual(
  left: TasksByColumn,
  right: TasksByColumn,
  columnIds: string[],
): boolean {
  return columnIds.every(
    (columnId) =>
      (left[columnId] ?? []).map((task) => task.id).join("\0") ===
      (right[columnId] ?? []).map((task) => task.id).join("\0"),
  );
}

export function collectionFromIdMap(
  lookup: Map<string, TaskSummary>,
  columnIds: string[],
  nextIds: Record<string, string[]>,
): TasksByColumn {
  const next: TasksByColumn = {};
  for (const columnId of columnIds) {
    next[columnId] = reindexColumnTasks(
      (nextIds[columnId] ?? [])
        .map((id) => {
          const task = lookup.get(id);
          return task ? { ...task, column_id: columnId } : null;
        })
        .filter((task): task is TaskSummary => task !== null),
    );
  }
  return next;
}

export function columnIdFromPoint(
  columnIds: string[],
  x: number,
  y: number,
): string | null {
  if (typeof document === "undefined") return null;
  const nodes = document.elementsFromPoint(x, y);
  for (const node of nodes) {
    const column = node.closest("[data-column-id]");
    if (!(column instanceof HTMLElement)) continue;
    const columnId = column.dataset.columnId;
    if (columnId && columnIds.includes(columnId)) return columnId;
  }
  return null;
}

export function destinationFromTarget(
  collection: TasksByColumn,
  columnIds: string[],
  target: BoardDragEntity | null | undefined,
): { columnId: string; index: number } | null {
  if (!target) return null;
  const targetId = target.id != null ? String(target.id) : "";
  const targetType = target.type != null ? String(target.type) : "";
  const groupId = target.group != null ? String(target.group) : "";

  let columnId: string | null = null;
  if (columnIds.includes(targetId) && (targetType === "column" || !targetType)) {
    columnId = targetId;
  } else if (targetType === "column" && columnIds.includes(targetId)) {
    columnId = targetId;
  } else if (columnIds.includes(groupId)) {
    columnId = groupId;
  } else if (targetId) {
    const hovered = findTaskLocation(collection, targetId);
    if (hovered) columnId = hovered.columnId;
  }
  if (!columnId || !columnIds.includes(columnId)) return null;

  const column = collection[columnId] ?? [];
  let index = column.length;
  if (typeof target.index === "number") {
    index = Math.min(Math.max(target.index, 0), column.length);
  } else if (targetId && targetId !== columnId) {
    const hoveredIndex = column.findIndex((task) => task.id === targetId);
    if (hoveredIndex >= 0) index = hoveredIndex;
  }
  return { columnId, index };
}

export function destinationFromDrop(
  collection: TasksByColumn,
  columnIds: string[],
  args: {
    target?: BoardDragEntity | null;
    targetId?: string | number | null;
    point?: { x: number; y: number } | null;
  },
): { columnId: string; index: number } | null {
  const fromTarget = destinationFromTarget(collection, columnIds, args.target);
  if (fromTarget) return fromTarget;
  const identifier = args.targetId != null ? String(args.targetId) : "";
  if (columnIds.includes(identifier)) {
    return { columnId: identifier, index: (collection[identifier] ?? []).length };
  }
  if (identifier) {
    const hovered = findTaskLocation(collection, identifier);
    if (hovered) return { columnId: hovered.columnId, index: hovered.index };
  }
  if (args.point) {
    const columnId = columnIdFromPoint(columnIds, args.point.x, args.point.y);
    if (columnId) {
      return { columnId, index: (collection[columnId] ?? []).length };
    }
  }
  return null;
}

export function moveTaskInCollection(
  collection: TasksByColumn,
  columnIds: string[],
  taskId: string,
  destColumnId: string,
  destIndex: number,
): TasksByColumn {
  const origin = findTaskLocation(collection, taskId);
  if (!origin || !columnIds.includes(destColumnId)) {
    return itemsByColumnIds(collection, columnIds);
  }
  const stripped: TasksByColumn = {
    ...collection,
    [origin.columnId]: collection[origin.columnId].filter((task) => task.id !== taskId),
  };
  const destinationBase = [...(stripped[destColumnId] ?? [])];
  const insertIndex = Math.min(Math.max(destIndex, 0), destinationBase.length);
  destinationBase.splice(insertIndex, 0, { ...origin.task, column_id: destColumnId });
  const next = itemsByColumnIds(
    {
      ...stripped,
      [destColumnId]: destinationBase,
    },
    columnIds,
  );
  next[origin.columnId] = reindexColumnTasks(next[origin.columnId] ?? []);
  next[destColumnId] = reindexColumnTasks(next[destColumnId] ?? []);
  return next;
}

export function collectionFromTargetFallback(
  snapshot: TasksByColumn,
  columnIds: string[],
  taskId: string,
  target: BoardDragEntity | null | undefined,
  extras?: {
    targetId?: string | number | null;
    point?: { x: number; y: number } | null;
  },
): TasksByColumn | null {
  const origin = findTaskLocation(snapshot, taskId);
  const destination =
    destinationFromDrop(snapshot, columnIds, {
      target,
      targetId: extras?.targetId,
      point: extras?.point,
    }) ?? destinationFromTarget(snapshot, columnIds, target);
  if (!origin || !destination) return null;
  const withoutOrigin = snapshot[origin.columnId].filter((task) => task.id !== taskId);
  const destinationBase =
    destination.columnId === origin.columnId
      ? withoutOrigin
      : [...(snapshot[destination.columnId] ?? [])];
  const insertIndex = Math.min(Math.max(destination.index, 0), destinationBase.length);
  const nextDest = [...destinationBase];
  nextDest.splice(insertIndex, 0, { ...origin.task, column_id: destination.columnId });
  const next = itemsByColumnIds(
    {
      ...snapshot,
      [origin.columnId]:
        origin.columnId === destination.columnId ? nextDest : withoutOrigin,
      [destination.columnId]: nextDest,
    },
    columnIds,
  );
  next[origin.columnId] = reindexColumnTasks(next[origin.columnId] ?? []);
  next[destination.columnId] = reindexColumnTasks(next[destination.columnId] ?? []);
  return next;
}

export function buildMovePayload(
  snapshot: TasksByColumn,
  finalCollection: TasksByColumn,
  taskId: string,
): BoardMovePayload {
  const origin = findTaskLocation(snapshot, taskId);
  const final = findTaskLocation(finalCollection, taskId);
  if (!origin || !final) {
    return {
      unchanged: true,
      taskId,
      targetColumnId: null,
      expectedVersion: origin?.task.version ?? 1,
      afterTaskId: null,
      beforeTaskId: null,
    };
  }
  const unchanged = origin.columnId === final.columnId && origin.index === final.index;
  const anchors = moveAnchors(finalCollection[final.columnId] ?? [], taskId);
  return {
    unchanged,
    taskId,
    targetColumnId: final.columnId,
    expectedVersion: origin.task.version,
    afterTaskId: anchors.after_task_id,
    beforeTaskId: anchors.before_task_id,
  };
}

export function applyMovedTaskVersion(
  items: TasksByColumn,
  columnIds: string[],
  task: Pick<TaskSummary, "id" | "column_id" | "position" | "version" | "completed_at">,
): TasksByColumn {
  const next = itemsByColumnIds(items, columnIds);
  let found: TaskSummary | null = null;
  for (const columnId of columnIds) {
    const match = (next[columnId] ?? []).find((item) => item.id === task.id);
    if (match) {
      found = match;
      next[columnId] = (next[columnId] ?? []).filter((item) => item.id !== task.id);
      break;
    }
  }
  if (!found || !columnIds.includes(task.column_id)) return next;
  const destination = [...(next[task.column_id] ?? [])];
  const insertAt = Math.min(Math.max(task.position, 0), destination.length);
  destination.splice(insertAt, 0, {
    ...found,
    column_id: task.column_id,
    position: task.position,
    version: task.version,
    completed_at: task.completed_at,
  });
  next[task.column_id] = reindexColumnTasks(destination);
  for (const columnId of columnIds) {
    if (columnId !== task.column_id) next[columnId] = reindexColumnTasks(next[columnId] ?? []);
  }
  return next;
}
