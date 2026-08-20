import type { Priority } from "../types";
import {
  DEFAULT_FILTERS,
  migrateDateRangeMode,
  next30Range,
  rangeForMode,
  type DateField,
  type DateRangeMode,
  type DateRangeValue,
} from "./date-presets";
import { isViewMode, type ViewMode } from "./view-mode";

export interface BoardPreferences {
  viewMode: ViewMode;
  dateField: DateField;
  rangeMode: DateRangeMode;
  categoryId: string;
  priority: Priority | "";
  customRange: DateRangeValue | null;
  anchorDate: string | null;
}

export function boardPreferencesKey(boardId: string): string {
  return `life-management:board-preferences:${boardId}`;
}

export function defaultBoardPreferences(): BoardPreferences {
  return {
    viewMode: "board",
    dateField: DEFAULT_FILTERS.dateField,
    rangeMode: DEFAULT_FILTERS.rangeMode,
    categoryId: DEFAULT_FILTERS.categoryId,
    priority: DEFAULT_FILTERS.priority,
    customRange: null,
    anchorDate: null,
  };
}

function isPriority(value: unknown): value is Priority | "" {
  return value === "" || value === "low" || value === "medium" || value === "high";
}

function isRangeTuple(value: unknown): value is DateRangeValue {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    (value[0] === null || typeof value[0] === "string") &&
    (value[1] === null || typeof value[1] === "string")
  );
}

export function readBoardPreferences(
  boardId: string,
  storage?: Pick<Storage, "getItem"> | null,
  today?: string,
): BoardPreferences {
  const defaults = defaultBoardPreferences();
  if (!storage) return defaults;
  const raw = storage.getItem(boardPreferencesKey(boardId));
  if (!raw) {
    const legacy = storage.getItem("life-management.view-mode");
    return isViewMode(legacy) ? { ...defaults, viewMode: legacy } : defaults;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<BoardPreferences> & { preset?: unknown };
    const storedMode = parsed.viewMode ?? null;
    const legacyPreset = parsed.rangeMode ?? parsed.preset;
    const rangeMode = migrateDateRangeMode(legacyPreset);
    let customRange = isRangeTuple(parsed.customRange) ? parsed.customRange : null;
    if (legacyPreset === "next_30") {
      const fallbackToday = today ?? parsed.anchorDate ?? null;
      customRange =
        customRange && customRange[0] && customRange[1]
          ? customRange
          : fallbackToday
            ? next30Range(fallbackToday)
            : customRange;
    }
    return {
      viewMode: isViewMode(storedMode) ? storedMode : defaults.viewMode,
      dateField: parsed.dateField === "created_at" ? "created_at" : "due_date",
      rangeMode,
      categoryId: typeof parsed.categoryId === "string" ? parsed.categoryId : "",
      priority: isPriority(parsed.priority) ? parsed.priority : "",
      customRange,
      anchorDate: typeof parsed.anchorDate === "string" ? parsed.anchorDate : null,
    };
  } catch {
    return defaults;
  }
}

export function writeBoardPreferences(
  boardId: string,
  prefs: BoardPreferences,
  storage?: Pick<Storage, "setItem"> | null,
): void {
  storage?.setItem(boardPreferencesKey(boardId), JSON.stringify(prefs));
}

export function clearBoardPreferences(
  boardId: string,
  storage?: Pick<Storage, "removeItem"> | null,
): void {
  storage?.removeItem(boardPreferencesKey(boardId));
}

export function rangesFromPreferences(
  prefs: BoardPreferences,
  today: string,
): { pickerRange: DateRangeValue; appliedRange: DateRangeValue } {
  if (prefs.rangeMode === "custom") {
    if (prefs.customRange?.[0] && prefs.customRange[1]) {
      return { pickerRange: prefs.customRange, appliedRange: prefs.customRange };
    }
    const month = rangeForMode("month", today);
    return { pickerRange: [null, null], appliedRange: month };
  }
  const range = rangeForMode(prefs.rangeMode, today, prefs.anchorDate);
  return { pickerRange: range, appliedRange: range };
}
