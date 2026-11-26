import { UNGROUPED_DROP_ID, canMoveBoardToFolder, folderDropId, folderMoveFromDrop } from "./board-folder-drop";

describe("folderMoveFromDrop", () => {
  it("moves an ungrouped board into a folder", () => {
    expect(folderMoveFromDrop({ boardId: "b1", folderId: null }, { folderId: "f1" })).toEqual({
      boardId: "b1",
      folderId: "f1",
    });
  });

  it("moves a board between folders and back to ungrouped", () => {
    expect(folderMoveFromDrop({ boardId: "b1", folderId: "f1" }, { folderId: "f2" })).toEqual({
      boardId: "b1",
      folderId: "f2",
    });
    expect(folderMoveFromDrop({ boardId: "b1", folderId: "f1" }, { folderId: null })).toEqual({
      boardId: "b1",
      folderId: null,
    });
  });

  it("ignores drops that change nothing", () => {
    expect(folderMoveFromDrop({ boardId: "b1", folderId: "f1" }, { folderId: "f1" })).toBeNull();
    expect(folderMoveFromDrop({ boardId: "b1", folderId: null }, { folderId: null })).toBeNull();
    expect(folderMoveFromDrop({ boardId: "b1", folderId: null }, { folderId: "f1" }, true)).toBeNull();
    expect(folderMoveFromDrop({ boardId: "b1", folderId: null }, undefined)).toBeNull();
    expect(folderMoveFromDrop({ id: "task" }, { folderId: "f1" })).toBeNull();
  });
});

describe("folder drop helpers", () => {
  it("names drop targets", () => {
    expect(folderDropId("f1")).toBe("board-folder:f1");
    expect(folderDropId(null)).toBe(UNGROUPED_DROP_ID);
  });

  it("lets only owners move boards between folders", () => {
    expect(canMoveBoardToFolder({ role: "owner" })).toBe(true);
    expect(canMoveBoardToFolder({})).toBe(true);
    expect(canMoveBoardToFolder({ role: "member" })).toBe(false);
  });
});
