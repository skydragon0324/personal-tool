import { describe, expect, it } from "vitest";

import {
  boardIdFromPath,
  isBoardDetailPath,
  isBoardsPath,
  sectionFromPath,
} from "./navigation";
import { boardsGroupExpanded } from "./boards-nav";

describe("application navigation", () => {
  it("treats the dashboard and board pages as the boards section", () => {
    expect(sectionFromPath("/")).toBe("boards");
    expect(sectionFromPath("/today")).toBe("today");
    expect(sectionFromPath("/boards")).toBe("boards");
    expect(sectionFromPath("/boards/abc")).toBe("boards");
    expect(sectionFromPath("/notepad")).toBe("notepad");
    expect(sectionFromPath("/schedule")).toBe("schedule");
    expect(isBoardsPath("/")).toBe(false);
    expect(isBoardsPath("/today")).toBe(false);
    expect(isBoardsPath("/boards")).toBe(true);
    expect(isBoardDetailPath("/boards")).toBe(false);
    expect(isBoardDetailPath("/boards/abc")).toBe(true);
    expect(boardIdFromPath("/boards/abc")).toBe("abc");
  });

  it("expands boards by default on board routes unless the user collapsed them", () => {
    expect(boardsGroupExpanded("/boards/abc", null)).toBe(true);
    expect(boardsGroupExpanded("/boards", null)).toBe(true);
    expect(boardsGroupExpanded("/notepad", null)).toBe(false);
    expect(boardsGroupExpanded("/boards/abc", true)).toBe(false);
    expect(boardsGroupExpanded("/notepad", false)).toBe(true);
  });
});
