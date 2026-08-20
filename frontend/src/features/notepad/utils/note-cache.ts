import type { Note } from "../types";

export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    const updated = b.updated_at.localeCompare(a.updated_at);
    if (updated) return updated;
    return b.created_at.localeCompare(a.created_at);
  });
}

export function replaceNoteInLists(notes: Note[] | undefined, next: Note): Note[] | undefined {
  if (!Array.isArray(notes)) return notes;
  return sortNotes(notes.map((item) => (item.id === next.id ? next : item)));
}

export function removeNoteFromLists(notes: Note[] | undefined, noteId: string): Note[] | undefined {
  if (!Array.isArray(notes)) return notes;
  return notes.filter((item) => item.id !== noteId);
}
