import type { NoteListParams } from "../types";

export const noteKeys = {
  all: ["notes"] as const,
  list: (params: NoteListParams) => ["notes", params] as const,
  detail: (noteId: string) => ["notes", noteId] as const,
};
