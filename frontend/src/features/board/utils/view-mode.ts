export type ViewMode = "board" | "table" | "progress";

export const VIEW_MODE_STORAGE_KEY = "life-management.view-mode";

export function isViewMode(value: string | null): value is ViewMode {
  return value === "board" || value === "table" || value === "progress";
}

export function readViewMode(storage?: Pick<Storage, "getItem"> | null): ViewMode {
  if (!storage) return "board";
  const stored = storage.getItem(VIEW_MODE_STORAGE_KEY);
  return isViewMode(stored) ? stored : "board";
}

export function writeViewMode(mode: ViewMode, storage?: Pick<Storage, "setItem"> | null): void {
  storage?.setItem(VIEW_MODE_STORAGE_KEY, mode);
}
