import { describe, expect, it } from "vitest";

import type { TaskSummary } from "../types";
import {
  applyMovedTaskVersion,
  buildMovePayload,
  collectionFromTargetFallback,
  destinationFromTarget,
  findTaskLocation,
  resolveOverlayTask,
} from "./board-move";

const COL_TODO = "col-todo";
const COL_DOING = "col-doing";
const COL_DONE = "col-done";
const COLUMN_IDS = [COL_TODO, COL_DOING, COL_DONE];

function task(
  id: string,
  columnId: string,
  position: number,
  extras: Partial<TaskSummary> = {},
): TaskSummary {
  return {
    id,
    column_id: columnId,
    title: id,
    due_date: "2026-08-20",
    start_date: "2026-08-20",
    priority: "medium",
    position,
    version: 1,
    completed_at: null,
    created_at: "2026-08-19T00:00:00Z",
    updated_at: "2026-08-19T00:00:00Z",
    content_preview: "",
    checklist_completed: 0,
    checklist_total: 0,
    link_count: 0,
    attachment_count: 0,
    subtask_total: 0,
    subtask_completed: 0,
    category: { id: "c", name: "Work", color: "blue" },
    ...extras,
  };
}

function snapshot() {
  return {
    [COL_TODO]: [task("alpha", COL_TODO, 0), task("bravo", COL_TODO, 1), task("charlie", COL_TODO, 2)],
    [COL_DOING]: [task("delta", COL_DOING, 0)],
    [COL_DONE]: [],
  };
}

function dropFromRealEvent(args: {
  sourceId: string;
  sourceGroup: string;
  sourceIndex: number;
  targetId: string;
  targetType: string;
  targetGroup?: string;
  targetIndex?: number;
}) {
  const current = snapshot();
  const origin = findTaskLocation(current, args.sourceId);
  expect(origin?.columnId).toBe(args.sourceGroup);
  expect(origin?.index).toBe(args.sourceIndex);
  const next = collectionFromTargetFallback(current, COLUMN_IDS, args.sourceId, {
    id: args.targetId,
    type: args.targetType,
    group: args.targetGroup,
    index: args.targetIndex,
  });
  expect(next).not.toBeNull();
  return buildMovePayload(current, next!, args.sourceId);
}

describe("board move destination uses target, not source", () => {
  it("moves down inside the same status using target.index", () => {
    const payload = dropFromRealEvent({
      sourceId: "alpha",
      sourceGroup: COL_TODO,
      sourceIndex: 0,
      targetId: "charlie",
      targetType: "item",
      targetGroup: COL_TODO,
      targetIndex: 2,
    });
    expect(payload.unchanged).toBe(false);
    expect(payload.targetColumnId).toBe(COL_TODO);
    expect(payload.afterTaskId).toBe("charlie");
    expect(payload.beforeTaskId).toBe(null);
  });

  it("moves up inside the same status using target.index", () => {
    const payload = dropFromRealEvent({
      sourceId: "charlie",
      sourceGroup: COL_TODO,
      sourceIndex: 2,
      targetId: "alpha",
      targetType: "item",
      targetGroup: COL_TODO,
      targetIndex: 0,
    });
    expect(payload.targetColumnId).toBe(COL_TODO);
    expect(payload.afterTaskId).toBe(null);
    expect(payload.beforeTaskId).toBe("alpha");
  });

  it("moves to the first slot of another status from target.group", () => {
    const payload = dropFromRealEvent({
      sourceId: "bravo",
      sourceGroup: COL_TODO,
      sourceIndex: 1,
      targetId: "delta",
      targetType: "item",
      targetGroup: COL_DOING,
      targetIndex: 0,
    });
    expect(payload.targetColumnId).toBe(COL_DOING);
    expect(payload.afterTaskId).toBe(null);
    expect(payload.beforeTaskId).toBe("delta");
  });

  it("moves to the middle of another status from target.index", () => {
    const current = {
      [COL_TODO]: [task("alpha", COL_TODO, 0), task("bravo", COL_TODO, 1)],
      [COL_DOING]: [task("delta", COL_DOING, 0), task("echo", COL_DOING, 1)],
      [COL_DONE]: [],
    };
    const next = collectionFromTargetFallback(current, COLUMN_IDS, "alpha", {
      id: "echo",
      type: "item",
      group: COL_DOING,
      index: 1,
    });
    const payload = buildMovePayload(current, next!, "alpha");
    expect(payload.targetColumnId).toBe(COL_DOING);
    expect(payload.afterTaskId).toBe("delta");
    expect(payload.beforeTaskId).toBe("echo");
  });

  it("moves to the last slot of another status", () => {
    const payload = dropFromRealEvent({
      sourceId: "bravo",
      sourceGroup: COL_TODO,
      sourceIndex: 1,
      targetId: "delta",
      targetType: "item",
      targetGroup: COL_DOING,
      targetIndex: 1,
    });
    expect(payload.targetColumnId).toBe(COL_DOING);
    expect(payload.afterTaskId).toBe("delta");
    expect(payload.beforeTaskId).toBe(null);
  });

  it("drops onto an empty status from a column target", () => {
    const payload = dropFromRealEvent({
      sourceId: "charlie",
      sourceGroup: COL_TODO,
      sourceIndex: 2,
      targetId: COL_DONE,
      targetType: "column",
      targetGroup: COL_DONE,
      targetIndex: 0,
    });
    expect(payload.targetColumnId).toBe(COL_DONE);
    expect(payload.afterTaskId).toBe(null);
    expect(payload.beforeTaskId).toBe(null);
  });

  it("uses a column targetIdentifier when target metadata is missing", () => {
    const payload = buildMovePayload(
      snapshot(),
      collectionFromTargetFallback(snapshot(), COLUMN_IDS, "alpha", null, {
        targetId: COL_DONE,
      })!,
      "alpha",
    );
    expect(payload.targetColumnId).toBe(COL_DONE);
    expect(payload.unchanged).toBe(false);
  });

  it("does not use a stale source.group as the destination", () => {
    const dest = destinationFromTarget(snapshot(), COLUMN_IDS, {
      id: "delta",
      type: "item",
      group: COL_DOING,
      index: 0,
    });
    expect(dest).toEqual({ columnId: COL_DOING, index: 0 });
  });

  it("builds an unchanged payload when the final collection matches the snapshot", () => {
    const current = snapshot();
    const payload = buildMovePayload(current, current, "alpha");
    expect(payload.unchanged).toBe(true);
  });

  it("resolves overlay tasks from snapshot, then projected collection, then initial data", () => {
    const current = snapshot();
    const projected = collectionFromTargetFallback(current, COLUMN_IDS, "alpha", {
      id: COL_DONE,
      type: "column",
      group: COL_DONE,
      index: 0,
    })!;
    expect(resolveOverlayTask("alpha", current, projected)?.title).toBe("alpha");
    expect(resolveOverlayTask("alpha", {}, projected)?.title).toBe("alpha");
    expect(resolveOverlayTask("alpha", {}, {}, current)?.title).toBe("alpha");
    expect(resolveOverlayTask("missing", current, projected, current)).toBeNull();
    expect(resolveOverlayTask("", current, projected)).toBeNull();
  });

  it("treats a filtered view neighbor list as the move anchors", () => {
    const visibleSnapshot = {
      [COL_TODO]: [task("alpha", COL_TODO, 0), task("charlie", COL_TODO, 2)],
      [COL_DOING]: [],
      [COL_DONE]: [],
    };
    const final = collectionFromTargetFallback(visibleSnapshot, COLUMN_IDS, "alpha", {
      id: "charlie",
      type: "item",
      group: COL_TODO,
      index: 1,
    });
    const payload = buildMovePayload(visibleSnapshot, final!, "alpha");
    expect(payload.afterTaskId).toBe("charlie");
    expect(payload.beforeTaskId).toBe(null);
  });
});

describe("applyMovedTaskVersion", () => {
  it("writes the server version, column, and completed_at", () => {
    const moved = applyMovedTaskVersion(
      {
        [COL_TODO]: [task("alpha", COL_TODO, 0)],
        [COL_DOING]: [],
        [COL_DONE]: [task("bravo", COL_DONE, 0)],
      },
      COLUMN_IDS,
      {
        id: "bravo",
        column_id: COL_DONE,
        position: 0,
        version: 4,
        completed_at: "2026-08-20T12:00:00Z",
      },
    );
    expect(moved[COL_DONE][0].version).toBe(4);
    expect(moved[COL_DONE][0].completed_at).toBe("2026-08-20T12:00:00Z");
  });

  it("rolls back by restoring the snapshot collection", () => {
    const original = snapshot();
    const moved = collectionFromTargetFallback(original, COLUMN_IDS, "alpha", {
      id: COL_DONE,
      type: "column",
      group: COL_DONE,
      index: 0,
    });
    expect(moved?.[COL_DONE][0].id).toBe("alpha");
    expect(original[COL_TODO][0].id).toBe("alpha");
    expect(original[COL_DONE]).toEqual([]);
  });
});
