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
    expect(sectionFromPath("/inbox")).toBe("inbox");
    expect(sectionFromPath("/my-tasks")).toBe("myTasks");
    expect(sectionFromPath("/calendar")).toBe("calendar");
    expect(sectionFromPath("/reports")).toBe("reports");
    expect(sectionFromPath("/boards")).toBe("boards");
    expect(sectionFromPath("/boards/abc")).toBe("boards");
    expect(sectionFromPath("/plans")).toBe("plans");
    expect(sectionFromPath("/plans/abc")).toBe("plans");
    expect(sectionFromPath("/notepad")).toBe("notepad");
    expect(sectionFromPath("/schedule")).toBe("schedule");
    expect(isBoardsPath("/")).toBe(false);
    expect(isBoardsPath("/today")).toBe(false);
    expect(isBoardsPath("/inbox")).toBe(false);
    expect(isBoardsPath("/boards")).toBe(true);
    expect(isBoardDetailPath("/boards")).toBe(false);
    expect(isBoardDetailPath("/boards/abc")).toBe(true);
    expect(boardIdFromPath("/boards/abc")).toBe("abc");
    expect(boardIdFromPath("/boards")).toBeUndefined();
    expect(sectionFromPath("/boards/abc")).toBe("boards");
    expect(isBoardsPath("/boards/abc")).toBe(true);
  });

  it("keeps boards expanded on every page unless the user collapsed them", () => {
    expect(boardsGroupExpanded("/boards/abc", null)).toBe(true);
    expect(boardsGroupExpanded("/boards", null)).toBe(true);
    expect(boardsGroupExpanded("/notepad", null)).toBe(true);
    expect(boardsGroupExpanded("/inbox", null)).toBe(true);
    expect(boardsGroupExpanded("/boards/abc", true)).toBe(false);
    expect(boardsGroupExpanded("/notepad", false)).toBe(true);
  });
});
