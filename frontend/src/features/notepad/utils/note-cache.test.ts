import { describe, expect, it } from "vitest";

import type { Note } from "../types";
import { removeNoteFromLists, replaceNoteInLists, sortNotes } from "./note-cache";

function note(partial: Partial<Note> & Pick<Note, "id" | "title">): Note {
  return {
    body: "",
    priority: null,
    is_pinned: false,
    created_at: "2026-08-19T10:00:00Z",
    updated_at: "2026-08-19T10:00:00Z",
    ...partial,
  };
}

describe("note cache helpers", () => {
  it("sorts pinned notes first then by updated time", () => {
    const notes = [
      note({ id: "a", title: "A", updated_at: "2026-08-19T12:00:00Z" }),
      note({ id: "b", title: "B", is_pinned: true, updated_at: "2026-08-19T08:00:00Z" }),
      note({ id: "c", title: "C", updated_at: "2026-08-19T13:00:00Z" }),
    ];
    expect(sortNotes(notes).map((item) => item.id)).toEqual(["b", "c", "a"]);
  });

  it("replaces a note and removes a missing note from list caches", () => {
    const notes = [
      note({ id: "a", title: "A" }),
      note({ id: "b", title: "B" }),
    ];
    const next = replaceNoteInLists(notes, note({ id: "b", title: "B", is_pinned: true }));
    expect(next?.[0].id).toBe("b");
    expect(removeNoteFromLists(notes, "a")?.map((item) => item.id)).toEqual(["b"]);
  });
});
