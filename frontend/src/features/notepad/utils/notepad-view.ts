export type NotepadView = "cards" | "table";

export const NOTEPAD_VIEW_STORAGE_KEY = "life-management:notepad-view";

export function isNotepadView(value: string | null): value is NotepadView {
  return value === "cards" || value === "table";
}

export function readNotepadView(storage?: Pick<Storage, "getItem"> | null): NotepadView {
  if (!storage) return "cards";
  const stored = storage.getItem(NOTEPAD_VIEW_STORAGE_KEY);
  return isNotepadView(stored) ? stored : "cards";
}

export function writeNotepadView(
  view: NotepadView,
  storage?: Pick<Storage, "setItem"> | null,
): void {
  storage?.setItem(NOTEPAD_VIEW_STORAGE_KEY, view);
}
