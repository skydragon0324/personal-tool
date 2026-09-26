import { describe, expect, it } from "vitest";

import type { AppNotification } from "../types";
import {
  LAST_ANNOUNCED_KEY,
  notificationHref,
  readDesktopEnabled,
  takeUnannounced,
  writeDesktopEnabled,
} from "./notification-utils";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  };
}

function item(id: string, createdAt: string, overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id,
    kind: "task_reminder",
    title: id,
    body: "",
    board_id: "board-1",
    task_id: "task-1",
    schedule_entry_id: null,
    fire_at: createdAt,
    read_at: null,
    created_at: createdAt,
    ...overrides,
  };
}

describe("takeUnannounced", () => {
  it("on first run only announces notifications created in the last two minutes", () => {
    const storage = memoryStorage();
    const fresh = takeUnannounced(
      [item("old", "2026-09-23T08:00:00Z"), item("new", "2026-09-23T08:59:30Z")],
      "2026-09-23T09:00:00Z",
      storage,
    );
    expect(fresh.map((entry) => entry.id)).toEqual(["new"]);
    expect(storage.data.get(LAST_ANNOUNCED_KEY)).toBe("2026-09-23T08:59:30.000Z");
  });

  it("announces each notification once and skips read ones", () => {
    const storage = memoryStorage({ [LAST_ANNOUNCED_KEY]: "2026-09-23T09:00:00.000Z" });
    const items = [
      item("b", "2026-09-23T09:02:00Z"),
      item("a", "2026-09-23T09:01:00Z"),
      item("read", "2026-09-23T09:03:00Z", { read_at: "2026-09-23T09:03:10Z" }),
    ];
    expect(takeUnannounced(items, "2026-09-23T09:04:00Z", storage).map((entry) => entry.id)).toEqual([
      "a",
      "b",
    ]);
    expect(takeUnannounced(items, "2026-09-23T09:05:00Z", storage)).toEqual([]);
  });

  it("still works when storage is unavailable", () => {
    const fresh = takeUnannounced([item("x", "2026-09-23T09:00:00Z")], "2026-09-23T09:00:30Z", null);
    expect(fresh.map((entry) => entry.id)).toEqual(["x"]);
  });
});

describe("notificationHref", () => {
  it("opens the task for reminders and Today for the rest", () => {
    expect(notificationHref(item("r", "2026-09-23T09:00:00Z"))).toBe("/boards/board-1?task=task-1");
    expect(
      notificationHref(item("d", "2026-09-23T09:00:00Z", { kind: "daily_digest", board_id: null, task_id: null })),
    ).toBe("/today");
    expect(
      notificationHref(item("s", "2026-09-23T09:00:00Z", { kind: "schedule_start", board_id: null, task_id: null })),
    ).toBe("/today");
    expect(
      notificationHref(item("a", "2026-09-23T09:00:00Z", { kind: "task_assigned", board_id: "b", task_id: "t" })),
    ).toBe("/boards/b?task=t");
    expect(
      notificationHref(item("b", "2026-09-23T09:00:00Z", { kind: "board_shared", board_id: "b", task_id: null })),
    ).toBe("/boards/b");
  });
});

describe("desktop preference", () => {
  it("defaults to on and can be turned off", () => {
    const storage = memoryStorage();
    expect(readDesktopEnabled(storage)).toBe(true);
    writeDesktopEnabled(storage, false);
    expect(readDesktopEnabled(storage)).toBe(false);
  });
});
