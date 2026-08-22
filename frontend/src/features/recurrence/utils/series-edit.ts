import type { RecurrenceInput, TiptapJSON } from "@/features/board/types";
import { ApiError } from "@/lib/api-client";
import {
  buildRecurrenceInput,
  presetFromRecurrence,
  repeatUnitFromRecurrence,
  type RepeatEnd,
  type RepeatPreset,
  type RepeatUnit,
} from "@/features/tasks/components/recurrence-fields";
import { sanitizeContentForPersist } from "@/features/tasks/utils/pending-images";

import type {
  RecurrenceSeriesLinkInput,
  RecurrenceSeriesRead,
  RecurrenceSeriesUpdatePayload,
} from "../types";

export const AUTOMATIC_COLUMN = "__automatic__";
export const STALE_SERIES_VERSION_DETAIL = "Recurrence series version is stale; refresh and try again";

export function isStaleSeriesVersion(error: unknown) {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    error.message === STALE_SERIES_VERSION_DETAIL
  );
}

export interface SeriesEditFormValues {
  title: string;
  categoryId: string | null;
  priority: RecurrenceSeriesRead["priority"];
  columnChoice: string;
  dtstart: string;
  durationDays: number;
  preset: RepeatPreset;
  customInterval: number;
  customUnit: RepeatUnit;
  customWeekdays: number[];
  end: RepeatEnd;
  untilDate: string | null;
  occurrenceCount: number;
  content: TiptapJSON | null;
  links: RecurrenceSeriesLinkInput[];
}

export function seriesToRecurrenceInput(series: RecurrenceSeriesRead): RecurrenceInput {
  return {
    freq: series.freq,
    interval: series.interval,
    weekdays: [...series.weekdays],
    month_day: series.month_day,
    until_date: series.until_date,
    occurrence_limit: series.occurrence_limit,
  };
}

export function formValuesFromDetail(detail: RecurrenceSeriesRead): SeriesEditFormValues {
  const recurrence = seriesToRecurrenceInput(detail);
  return {
    title: detail.title,
    categoryId: detail.category_id,
    priority: detail.priority,
    columnChoice: detail.default_column_id ?? AUTOMATIC_COLUMN,
    dtstart: detail.dtstart,
    durationDays: detail.duration_days,
    preset: presetFromRecurrence(recurrence),
    customInterval: detail.interval,
    customUnit: repeatUnitFromRecurrence(recurrence),
    customWeekdays: detail.weekdays.length ? [...detail.weekdays] : [0, 1, 2, 3, 4],
    end: detail.until_date ? "date" : detail.occurrence_limit ? "count" : "never",
    untilDate: detail.until_date,
    occurrenceCount: detail.occurrence_limit ?? 10,
    content: detail.content,
    links: detail.links.map((link) => ({
      id: link.id,
      label: link.label,
      url: link.url,
      position: link.position,
    })),
  };
}

export function normalizeRecurrence(rule: RecurrenceInput, dtstart: string) {
  const freq = rule.freq;
  const interval = rule.interval ?? 1;
  const weekdays =
    freq === "weekly" ? [...(rule.weekdays ?? [])].map(Number).sort((a, b) => a - b) : [];
  const startDay = Number(dtstart.slice(8, 10));
  const monthDay =
    freq === "monthly" || freq === "yearly" ? (rule.month_day ?? startDay) : null;
  return {
    freq,
    interval,
    weekdays,
    month_day: monthDay,
    until_date: rule.until_date ?? null,
    occurrence_limit: rule.occurrence_limit ?? null,
  };
}

export function recurrencesEqual(left: RecurrenceInput, right: RecurrenceInput, dtstart: string) {
  return JSON.stringify(normalizeRecurrence(left, dtstart)) === JSON.stringify(normalizeRecurrence(right, dtstart));
}

export function linkTuples(links: RecurrenceSeriesLinkInput[]) {
  return links.map((link, index) => ({
    label: link.label.trim(),
    url: link.url.trim(),
    position: index,
  }));
}

export function linksEqual(left: RecurrenceSeriesLinkInput[], right: RecurrenceSeriesLinkInput[]) {
  return JSON.stringify(linkTuples(left)) === JSON.stringify(linkTuples(right));
}

function isEffectivelyEmptyContent(content: TiptapJSON | null): boolean {
  if (!content) return true;
  let meaningful = false;
  function walk(node: unknown) {
    if (meaningful || !node || typeof node !== "object") return;
    const current = node as Record<string, unknown>;
    if (current.type === "text" && typeof current.text === "string" && current.text.trim()) {
      meaningful = true;
      return;
    }
    if (current.type === "image" || current.type === "taskItem") {
      meaningful = true;
      return;
    }
    for (const child of (current.content as unknown[]) ?? []) walk(child);
  }
  walk(content);
  return !meaningful;
}

export function normalizeContent(content: TiptapJSON | null): TiptapJSON | null {
  const sanitized = sanitizeContentForPersist(content);
  if (isEffectivelyEmptyContent(sanitized)) return null;
  return sanitized;
}

export function contentsEqual(left: TiptapJSON | null, right: TiptapJSON | null) {
  return JSON.stringify(normalizeContent(left)) === JSON.stringify(normalizeContent(right));
}

export function columnPayloadValue(columnChoice: string): string | null {
  return columnChoice === AUTOMATIC_COLUMN ? null : columnChoice;
}

export function validateSeriesEditForm(values: SeriesEditFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (values.preset === "none") errors.repeat = "Choose a repeat rule.";
  if (!values.title.trim()) errors.title = "Enter a title.";
  if (!values.categoryId) errors.category = "Choose a category.";
  if (!Number.isFinite(values.durationDays) || values.durationDays < 0) {
    errors.duration = "Duration must be 0 or more days.";
  }
  if (values.preset === "custom" && (!Number.isFinite(values.customInterval) || values.customInterval < 1)) {
    errors.interval = "Repeat interval must be at least 1.";
  }
  if (values.preset === "custom" && values.customUnit === "weeks" && values.customWeekdays.length === 0) {
    errors.weekdays = "Choose at least one weekday.";
  }
  if (values.preset !== "none" && values.end === "date") {
    if (!values.untilDate) errors.until = "Choose an end date.";
    else if (values.untilDate < values.dtstart) errors.until = "End date cannot be before the series start date.";
  }
  if (values.preset !== "none" && values.end === "count") {
    if (!Number.isFinite(values.occurrenceCount) || values.occurrenceCount < 1) {
      errors.count = "Occurrence count must be at least 1.";
    }
  }
  values.links.forEach((link, index) => {
    if (!link.label.trim() || !link.url.trim() || link.url.trim() === "https://") {
      errors[`link-${index}`] = "Link name and URL are required.";
    }
  });
  return errors;
}

export function recurrenceFromForm(values: SeriesEditFormValues): RecurrenceInput | null {
  return buildRecurrenceInput({
    preset: values.preset,
    startDate: values.dtstart,
    customInterval: values.customInterval,
    customUnit: values.customUnit,
    customWeekdays: values.customWeekdays,
    end: values.end,
    untilDate: values.untilDate,
    occurrenceCount: values.occurrenceCount,
  });
}

export function buildSeriesUpdatePayload(
  detail: RecurrenceSeriesRead,
  values: SeriesEditFormValues,
): RecurrenceSeriesUpdatePayload | null {
  const recurrence = recurrenceFromForm(values);
  if (recurrence === null) return null;

  const payload: RecurrenceSeriesUpdatePayload = {
    expected_version: detail.version,
  };
  const title = values.title.trim();
  if (title !== detail.title) payload.title = title;
  if (values.priority !== detail.priority) payload.priority = values.priority;
  if (values.categoryId && values.categoryId !== detail.category_id) payload.category_id = values.categoryId;
  const columnValue = columnPayloadValue(values.columnChoice);
  if (columnValue !== detail.default_column_id) payload.default_column_id = columnValue;
  if (values.durationDays !== detail.duration_days) payload.duration_days = values.durationDays;
  if (values.dtstart !== detail.dtstart) payload.dtstart = values.dtstart;
  if (!contentsEqual(values.content, detail.content)) payload.content = normalizeContent(values.content);
  if (!linksEqual(values.links, detail.links)) payload.links = linkTuples(values.links);
  if (!recurrencesEqual(recurrence, seriesToRecurrenceInput(detail), values.dtstart)) {
    payload.recurrence = recurrence;
  }

  return Object.keys(payload).length === 1 ? null : payload;
}
