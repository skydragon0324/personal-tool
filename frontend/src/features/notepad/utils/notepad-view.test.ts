import { describe, expect, it } from "vitest";

import {
  NOTEPAD_VIEW_STORAGE_KEY,
  isNotepadView,
  readNotepadView,
  writeNotepadView,
} from "./notepad-view";

describe("notepad view", () => {
  it("persists cards and table views", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    };
    expect(readNotepadView(storage)).toBe("cards");
    writeNotepadView("table", storage);
    expect(store.get(NOTEPAD_VIEW_STORAGE_KEY)).toBe("table");
    expect(readNotepadView(storage)).toBe("table");
    expect(isNotepadView("cards")).toBe(true);
    expect(isNotepadView("kanban")).toBe(false);
  });
});
