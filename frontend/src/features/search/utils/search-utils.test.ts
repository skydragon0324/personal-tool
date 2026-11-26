import type { SearchGroup, SearchResult } from "../types";
import { isApplePlatform, isEditableTarget, isSearchShortcut, shortcutAria, shortcutLabel } from "./search-hotkey";
import { flattenResults, moveActive, resultHref, sortGroups } from "./search-results";

const key = (extra: Partial<KeyboardEvent> = {}) => ({
  key: "k",
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...extra,
});

const result = (type: SearchResult["type"], id: string, extra: Partial<SearchResult> = {}): SearchResult => ({
  type,
  id,
  label: id,
  secondary: null,
  board_id: null,
  board_name: null,
  board_color: null,
  due_date: null,
  is_done: null,
  ...extra,
});

describe("search shortcut", () => {
  it("is Ctrl+K on Windows and Linux", () => {
    expect(isSearchShortcut(key({ ctrlKey: true }), false)).toBe(true);
    expect(isSearchShortcut(key({ ctrlKey: true, key: "K" }), false)).toBe(true);
    expect(isSearchShortcut(key({ metaKey: true }), false)).toBe(false);
    expect(isSearchShortcut(key({ ctrlKey: true, shiftKey: true }), false)).toBe(false);
    expect(isSearchShortcut(key({ ctrlKey: true, key: "j" }), false)).toBe(false);
    expect(shortcutLabel(false)).toBe("Ctrl+K");
    expect(shortcutAria(false)).toBe("Control+K");
  });

  it("is Cmd+K on macOS", () => {
    expect(isSearchShortcut(key({ metaKey: true }), true)).toBe(true);
    expect(isSearchShortcut(key({ ctrlKey: true }), true)).toBe(false);
    expect(shortcutLabel(true)).toBe("⌘K");
    expect(shortcutAria(true)).toBe("Meta+K");
    expect(isApplePlatform({ platform: "MacIntel", userAgent: "" })).toBe(true);
    expect(isApplePlatform({ platform: "Win32", userAgent: "" })).toBe(false);
  });

  it("treats text fields and editors as typing places, but not buttons or checkboxes", () => {
    const text = document.createElement("input");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    const editor = document.createElement("div");
    editor.setAttribute("contenteditable", "true");
    const insideEditor = document.createElement("p");
    editor.appendChild(insideEditor);
    document.body.append(text, checkbox, editor);
    expect(isEditableTarget(text)).toBe(true);
    expect(isEditableTarget(document.createElement("textarea"))).toBe(true);
    expect(isEditableTarget(document.createElement("select"))).toBe(true);
    expect(isEditableTarget(insideEditor)).toBe(true);
    expect(isEditableTarget(checkbox)).toBe(false);
    expect(isEditableTarget(document.createElement("button"))).toBe(false);
    expect(isEditableTarget(document.body)).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
    editor.remove();
    text.remove();
    checkbox.remove();
  });
});

describe("search results", () => {
  it("opens every result type in the right place", () => {
    expect(resultHref(result("task", "t1", { board_id: "b1" }))).toBe("/boards/b1?task=t1");
    expect(resultHref(result("board", "b1"))).toBe("/boards/b1");
    expect(resultHref(result("note", "n1"))).toBe("/notepad?note=n1");
    expect(resultHref(result("plan", "p1"))).toBe("/plans/p1");
  });

  it("orders groups by type and drops empty ones", () => {
    const groups: SearchGroup[] = [
      { type: "plan", items: [result("plan", "p1")], has_more: false },
      { type: "task", items: [result("task", "t1"), result("task", "t2")], has_more: false },
      { type: "note", items: [], has_more: false },
    ];
    expect(sortGroups(groups).map((group) => group.type)).toEqual(["task", "plan"]);
    expect(flattenResults(groups).map((item) => item.id)).toEqual(["t1", "t2", "p1"]);
  });

  it("wraps arrow-key movement at both ends", () => {
    expect(moveActive(-1, 3, 1)).toBe(0);
    expect(moveActive(-1, 3, -1)).toBe(2);
    expect(moveActive(2, 3, 1)).toBe(0);
    expect(moveActive(0, 3, -1)).toBe(2);
    expect(moveActive(0, 0, 1)).toBe(-1);
  });
});
