import {
  boardPreferencesKey,
  defaultBoardPreferences,
  migratePriorities,
  migrateStringSelections,
  clearBoardPreferences,
  rangesFromPreferences,
  readBoardPreferences,
  writeBoardPreferences,
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

describe("board preferences priority filter", () => {
  const boardId = "board-1";
  const key = boardPreferencesKey(boardId);

  it("defaults to no selected priorities", () => {
    expect(defaultBoardPreferences().priorities).toEqual([]);
    expect(readBoardPreferences(boardId, memoryStorage()).priorities).toEqual([]);
  });

  it("migrates a stored single priority to a list", () => {
    const storage = memoryStorage({ [key]: JSON.stringify({ priority: "high" }) });
    expect(readBoardPreferences(boardId, storage).priorities).toEqual(["high"]);
  });

  it("migrates the old empty value to no selection", () => {
    const storage = memoryStorage({ [key]: JSON.stringify({ priority: "" }) });
    expect(readBoardPreferences(boardId, storage).priorities).toEqual([]);
  });

  it("reads stored lists, dropping unknown values and duplicates", () => {
    const storage = memoryStorage({
      [key]: JSON.stringify({ priorities: ["low", "urgent", "high", "low"], priority: "medium" }),
    });
    expect(readBoardPreferences(boardId, storage).priorities).toEqual(["high", "low"]);
  });

  it("persists the selected priorities", () => {
    const storage = memoryStorage();
    writeBoardPreferences(boardId, { ...defaultBoardPreferences(), priorities: ["medium", "low"] }, storage);
    expect(JSON.parse(storage.store[key]).priorities).toEqual(["medium", "low"]);
    expect(readBoardPreferences(boardId, storage).priorities).toEqual(["medium", "low"]);
  });

  it("migrates odd stored values safely", () => {
    expect(migratePriorities(undefined, undefined)).toEqual([]);
    expect(migratePriorities(null)).toEqual([]);
    expect(migratePriorities("bogus")).toEqual([]);
    expect(migratePriorities(undefined, "low")).toEqual(["low"]);
  });
});

describe("board preferences category filters", () => {
  const boardId = "board-1";
  const key = boardPreferencesKey(boardId);

  it("defaults to no selected categories", () => {
    expect(defaultBoardPreferences().categoryIds).toEqual([]);
  });

  it("migrates the previous single category preference", () => {
    const storage = memoryStorage({ [key]: JSON.stringify({ categoryId: "cat-work" }) });
    expect(readBoardPreferences(boardId, storage).categoryIds).toEqual(["cat-work"]);
  });

  it("reads and persists multiple categories without duplicates", () => {
    const storage = memoryStorage({ [key]: JSON.stringify({ categoryIds: ["cat-work", "cat-home", "cat-work"] }) });
    expect(readBoardPreferences(boardId, storage).categoryIds).toEqual(["cat-work", "cat-home"]);
    writeBoardPreferences(boardId, { ...defaultBoardPreferences(), categoryIds: ["cat-home", "cat-work"] }, storage);
    expect(JSON.parse(storage.store[key]).categoryIds).toEqual(["cat-home", "cat-work"]);
  });

  it("drops empty and non-string selection values", () => {
    expect(migrateStringSelections(["cat-work", "", null, "cat-work", 4])).toEqual(["cat-work"]);
  });
});
