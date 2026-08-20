import { describe, expect, it } from "vitest";

import { LAST_BOARD_STORAGE_KEY, resolveLastBoardId } from "./last-board";
import {
  boardPreferencesKey,
  defaultBoardPreferences,
  readBoardPreferences,
  writeBoardPreferences,
} from "./board-preferences";

describe("last board restore", () => {
  it("prefers the stored active board and skips archived ones", () => {
    const boards = [
      { id: "a", archived_at: null, position: 1 },
      { id: "b", archived_at: "2026-01-01", position: 0 },
      { id: "c", archived_at: null, position: 0 },
    ];
    expect(resolveLastBoardId(boards, "a")).toBe("a");
    expect(resolveLastBoardId(boards, "b")).toBe("c");
    expect(resolveLastBoardId(boards, null)).toBe("c");
    expect(LAST_BOARD_STORAGE_KEY).toBe("life-management:last-board-id");
  });
});

describe("board preferences", () => {
  it("stores settings per board id", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    };
    const prefs = { ...defaultBoardPreferences(), viewMode: "table" as const, categoryId: "cat-1" };
    writeBoardPreferences("board-1", prefs, storage);
    expect(store.get(boardPreferencesKey("board-1"))).toContain("table");
    expect(readBoardPreferences("board-1", storage).viewMode).toBe("table");
    expect(readBoardPreferences("board-2", storage).viewMode).toBe("board");
  });
});
