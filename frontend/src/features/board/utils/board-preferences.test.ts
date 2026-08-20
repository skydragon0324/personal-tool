import { describe, expect, it } from "vitest";

import {
  boardPreferencesKey,
  clearBoardPreferences,
  rangesFromPreferences,
  readBoardPreferences,
} from "./board-preferences";

function memoryStorage(initial: Record<string, string> = {}) {
  const store = { ...initial };
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    store,
  };
}

describe("board preferences date migration", () => {
  const boardId = "board-1";
  const key = boardPreferencesKey(boardId);

  it("migrates today, this_week, this_month, and all", () => {
    const today = memoryStorage({
      [key]: JSON.stringify({ preset: "today" }),
    });
    expect(readBoardPreferences(boardId, today, "2026-08-19").rangeMode).toBe("day");

    const week = memoryStorage({
      [key]: JSON.stringify({ preset: "this_week" }),
    });
    expect(readBoardPreferences(boardId, week, "2026-08-19").rangeMode).toBe("week");

    const month = memoryStorage({
      [key]: JSON.stringify({ preset: "this_month" }),
    });
    expect(readBoardPreferences(boardId, month, "2026-08-19").rangeMode).toBe("month");

    const all = memoryStorage({
      [key]: JSON.stringify({ preset: "all" }),
    });
    expect(readBoardPreferences(boardId, all, "2026-08-19").rangeMode).toBe("all");
  });

  it("migrates next_30 to custom and keeps the previous 30-day span", () => {
    const storage = memoryStorage({
      [key]: JSON.stringify({ preset: "next_30" }),
    });
    const prefs = readBoardPreferences(boardId, storage, "2026-08-19");
    expect(prefs.rangeMode).toBe("custom");
    expect(prefs.customRange).toEqual(["2026-08-19", "2026-09-17"]);
    expect(rangesFromPreferences(prefs, "2026-08-19").appliedRange).toEqual([
      "2026-08-19",
      "2026-09-17",
    ]);
  });

  it("keeps an existing custom range when migrating next_30", () => {
    const storage = memoryStorage({
      [key]: JSON.stringify({
        preset: "next_30",
        customRange: ["2026-01-01", "2026-01-30"],
      }),
    });
    const prefs = readBoardPreferences(boardId, storage, "2026-08-19");
    expect(prefs.customRange).toEqual(["2026-01-01", "2026-01-30"]);
  });

  it("removes stored preferences for a deleted board", () => {
    const storage = memoryStorage({
      [key]: JSON.stringify({ rangeMode: "year" }),
    });
    clearBoardPreferences(boardId, storage);
    expect(storage.getItem(key)).toBeNull();
  });
});
