import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import type { TaskSummary } from "../types";
import { useBoardDnd } from "./use-board-dnd";

const moveMutate = vi.fn();
const notifyApiError = vi.fn();
const notifyConflict = vi.fn();

vi.mock("./use-move-task", () => ({
  useMoveTask: () => ({
    mutateAsync: (...args: unknown[]) => moveMutate(...args),
    isPending: false,
  }),
}));

vi.mock("@/lib/notify", () => ({
  notifyApiError: (...args: unknown[]) => notifyApiError(...args),
  notifyConflict: (...args: unknown[]) => notifyConflict(...args),
}));

const COL_TODO = "col-todo";
const COL_DOING = "col-doing";
const COL_DONE = "col-done";
const COLUMN_IDS = [COL_TODO, COL_DOING, COL_DONE];

function task(id: string, columnId: string, position: number): TaskSummary {
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
  };
}

function initial() {
  return {
    [COL_TODO]: [task("alpha", COL_TODO, 0), task("bravo", COL_TODO, 1)],
    [COL_DOING]: [task("delta", COL_DOING, 0)],
    [COL_DONE]: [],
  };
}

const query = {
  boardId: "board-1",
  startDate: "2026-08-20",
  endDate: "2026-08-20",
  dateField: "due_date" as const,
  unbounded: true,
};

function dragEvent(
  target: {
    id: string;
    type: string;
    group: string;
    index: number;
  },
  canceled = false,
  source = {
    id: "alpha",
    type: "item",
    group: COL_TODO,
    index: 0,
    initialGroup: COL_TODO,
    initialIndex: 0,
  },
) {
  return {
    canceled,
    operation: {
      source,
      target,
    },
  } as never;
}

function endEvent(
  target: {
    id: string;
    type: string;
    group: string;
    index: number;
  },
  canceled = false,
) {
  return dragEvent(target, canceled);
}

const SAMPLE = initial();

describe("useBoardDnd persistence", () => {
  beforeEach(() => {
    moveMutate.mockReset();
    notifyApiError.mockReset();
    notifyConflict.mockReset();
    moveMutate.mockResolvedValue({
      id: "alpha",
      column_id: COL_DONE,
      position: 0,
      version: 2,
      completed_at: "2026-08-20T12:00:00Z",
    });
  });

  it("does not call the move API when drag is canceled", async () => {
    const { result } = renderHook(() =>
      useBoardDnd({ query, columnIds: COLUMN_IDS, initialTasksByColumn: SAMPLE }),
    );
    act(() => result.current.onDragStart("alpha"));
    await act(async () => {
      await result.current.onDragEnd(
        endEvent({ id: COL_DONE, type: "column", group: COL_DONE, index: 0 }, true),
      );
    });
    expect(moveMutate).not.toHaveBeenCalled();
    expect(result.current.items[COL_TODO][0].id).toBe("alpha");
    expect(result.current.items[COL_DONE]).toEqual([]);
  });

  it("uses target metadata when drag-over never ran", async () => {
    const { result } = renderHook(() =>
      useBoardDnd({ query, columnIds: COLUMN_IDS, initialTasksByColumn: SAMPLE }),
    );
    act(() => result.current.onDragStart("alpha"));
    await act(async () => {
      await result.current.onDragEnd(
        endEvent({ id: COL_DONE, type: "column", group: COL_DONE, index: 0 }),
      );
    });
    expect(moveMutate).toHaveBeenCalledWith({
      taskId: "alpha",
      payload: {
        target_column_id: COL_DONE,
        expected_version: 1,
        after_task_id: null,
        before_task_id: null,
      },
    });
    expect(result.current.items[COL_DONE][0].id).toBe("alpha");
    expect(result.current.items[COL_DONE][0].version).toBe(2);
  });

  it("rolls back to the snapshot when the API fails", async () => {
    moveMutate.mockRejectedValue(new ApiError("Could not move", 500));
    const { result } = renderHook(() =>
      useBoardDnd({ query, columnIds: COLUMN_IDS, initialTasksByColumn: SAMPLE }),
    );
    act(() => result.current.onDragStart("alpha"));
    await act(async () => {
      await result.current.onDragEnd(
        endEvent({ id: COL_DONE, type: "column", group: COL_DONE, index: 0 }),
      );
    });
    expect(result.current.items[COL_TODO][0].id).toBe("alpha");
    expect(result.current.items[COL_DONE]).toEqual([]);
    expect(notifyApiError).toHaveBeenCalled();
  });

  it("rolls back and reports a stale version on 409", async () => {
    moveMutate.mockRejectedValue(new ApiError("Conflict", 409));
    const { result } = renderHook(() =>
      useBoardDnd({ query, columnIds: COLUMN_IDS, initialTasksByColumn: SAMPLE }),
    );
    act(() => result.current.onDragStart("alpha"));
    await act(async () => {
      await result.current.onDragEnd(
        endEvent({ id: COL_DOING, type: "item", group: COL_DOING, index: 0 }),
      );
    });
    expect(result.current.items[COL_TODO][0].id).toBe("alpha");
    expect(notifyConflict).toHaveBeenCalled();
  });
});

describe("useBoardDnd live projection and overlay", () => {
  beforeEach(() => {
    moveMutate.mockReset();
    notifyApiError.mockReset();
    notifyConflict.mockReset();
    moveMutate.mockResolvedValue({
      id: "alpha",
      column_id: COL_DONE,
      position: 0,
      version: 2,
      completed_at: "2026-08-20T12:00:00Z",
    });
  });

  it("finds the overlay task after drag start from the drag snapshot", () => {
    const { result } = renderHook(() =>
      useBoardDnd({ query, columnIds: COLUMN_IDS, initialTasksByColumn: SAMPLE }),
    );
    act(() => result.current.onDragStart("alpha"));
    expect(result.current.resolveOverlayTask("alpha", SAMPLE)?.id).toBe("alpha");
    expect(result.current.resolveOverlayTask("alpha", SAMPLE)?.title).toBe("alpha");
  });

  it("reorders the same column during drag over", () => {
    const { result } = renderHook(() =>
      useBoardDnd({ query, columnIds: COLUMN_IDS, initialTasksByColumn: SAMPLE }),
    );
    act(() => result.current.onDragStart("alpha"));
    act(() => {
      result.current.onDragOver(
        dragEvent({ id: "bravo", type: "item", group: COL_TODO, index: 1 }),
      );
    });
    expect(result.current.items[COL_TODO].map((task) => task.id)).toEqual(["bravo", "alpha"]);
    expect(result.current.resolveOverlayTask("alpha", SAMPLE)?.id).toBe("alpha");
  });

  it("moves a task into another column during drag over", () => {
    const { result } = renderHook(() =>
      useBoardDnd({ query, columnIds: COLUMN_IDS, initialTasksByColumn: SAMPLE }),
    );
    act(() => result.current.onDragStart("alpha"));
    act(() => {
      result.current.onDragOver(
        dragEvent({ id: "delta", type: "item", group: COL_DOING, index: 0 }),
      );
    });
    expect(result.current.items[COL_TODO].map((task) => task.id)).toEqual(["bravo"]);
    expect(result.current.items[COL_DOING].map((task) => task.id)).toEqual(["alpha", "delta"]);
  });

  it("projects into an empty column target", () => {
    const { result } = renderHook(() =>
      useBoardDnd({ query, columnIds: COLUMN_IDS, initialTasksByColumn: SAMPLE }),
    );
    act(() => result.current.onDragStart("alpha"));
    act(() => {
      result.current.onDragOver(
        dragEvent({ id: COL_DONE, type: "column", group: COL_DONE, index: 0 }),
      );
    });
    expect(result.current.items[COL_DONE].map((task) => task.id)).toEqual(["alpha"]);
    expect(result.current.items[COL_TODO].map((task) => task.id)).toEqual(["bravo"]);
  });

  it("keeps the dragged task visible while crossing multiple statuses", () => {
    const { result } = renderHook(() =>
      useBoardDnd({ query, columnIds: COLUMN_IDS, initialTasksByColumn: SAMPLE }),
    );
    act(() => result.current.onDragStart("alpha"));
    act(() => {
      result.current.onDragOver(
        dragEvent({ id: "delta", type: "item", group: COL_DOING, index: 0 }),
      );
    });
    act(() => {
      result.current.onDragOver(
        dragEvent({ id: COL_DONE, type: "column", group: COL_DONE, index: 0 }),
      );
    });
    const ids = [
      ...result.current.items[COL_TODO],
      ...result.current.items[COL_DOING],
      ...result.current.items[COL_DONE],
    ].map((task) => task.id);
    expect(ids.filter((id) => id === "alpha")).toHaveLength(1);
    expect(result.current.items[COL_DONE][0].id).toBe("alpha");
  });

  it("uses source origin and target destination in the live event", () => {
    const { result } = renderHook(() =>
      useBoardDnd({ query, columnIds: COLUMN_IDS, initialTasksByColumn: SAMPLE }),
    );
    const source = {
      id: "alpha",
      type: "item",
      group: COL_TODO,
      index: 0,
      initialGroup: COL_TODO,
      initialIndex: 0,
    };
    const target = { id: "delta", type: "item", group: COL_DOING, index: 0 };
    expect(source.group).toBe(COL_TODO);
    expect(source.index).toBe(0);
    expect(target.group).toBe(COL_DOING);
    expect(target.index).toBe(0);
    act(() => result.current.onDragStart("alpha"));
    act(() => result.current.onDragOver(dragEvent(target, false, source)));
    expect(result.current.items[COL_DOING][0].id).toBe("alpha");
  });

  it("restores the snapshot when drag is canceled after a live preview", async () => {
    const { result } = renderHook(() =>
      useBoardDnd({ query, columnIds: COLUMN_IDS, initialTasksByColumn: SAMPLE }),
    );
    act(() => result.current.onDragStart("alpha"));
    act(() => {
      result.current.onDragOver(
        dragEvent({ id: COL_DONE, type: "column", group: COL_DONE, index: 0 }),
      );
    });
    expect(result.current.items[COL_DONE][0].id).toBe("alpha");
    await act(async () => {
      await result.current.onDragEnd(
        endEvent({ id: COL_DONE, type: "column", group: COL_DONE, index: 0 }, true),
      );
    });
    expect(moveMutate).not.toHaveBeenCalled();
    expect(result.current.items[COL_TODO][0].id).toBe("alpha");
    expect(result.current.items[COL_DONE]).toEqual([]);
  });

  it("rolls back a live preview when the API fails", async () => {
    moveMutate.mockRejectedValue(new ApiError("Could not move", 500));
    const { result } = renderHook(() =>
      useBoardDnd({ query, columnIds: COLUMN_IDS, initialTasksByColumn: SAMPLE }),
    );
    act(() => result.current.onDragStart("alpha"));
    act(() => {
      result.current.onDragOver(
        dragEvent({ id: COL_DONE, type: "column", group: COL_DONE, index: 0 }),
      );
    });
    await act(async () => {
      await result.current.onDragEnd(
        endEvent({ id: COL_DONE, type: "column", group: COL_DONE, index: 0 }),
      );
    });
    expect(result.current.items[COL_TODO][0].id).toBe("alpha");
    expect(result.current.items[COL_DONE]).toEqual([]);
    expect(notifyApiError).toHaveBeenCalled();
  });
});
