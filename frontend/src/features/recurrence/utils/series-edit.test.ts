import { describe, expect, it } from "vitest";

import type { RecurrenceInput } from "@/features/board/types";
import {
  buildRecurrenceInput,
  presetFromRecurrence,
  repeatUnitFromRecurrence,
} from "@/features/tasks/components/recurrence-fields";

import type { RecurrenceSeriesRead } from "../types";
import {
  AUTOMATIC_COLUMN,
  buildSeriesUpdatePayload,
  formValuesFromDetail,
  recurrencesEqual,
  seriesToRecurrenceInput,
  validateSeriesEditForm,
} from "./series-edit";

const DETAIL: RecurrenceSeriesRead = {
  id: "series-1",
  board_id: "board-work",
  default_column_id: "col-todo",
  category_id: "cat-1",
  title: "Weekly report",
  priority: "medium",
  duration_days: 1,
  timezone: "UTC",
  freq: "weekly",
  interval: 1,
  weekdays: [4],
  month_day: null,
  until_date: null,
  occurrence_limit: null,
  status: "active",
  dtstart: "2026-08-21",
  generated_through: "2026-10-22",
  next_occurrence_date: "2026-08-21",
  open_count: 3,
  completed_count: 1,
  detached_count: 0,
  version: 4,
  content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "body" }] }] },
  content_schema_version: 1,
  links: [{ id: "link-1", label: "Docs", url: "https://example.com/docs", position: 0 }],
};

function roundTrip(rule: RecurrenceInput, dtstart = "2026-08-21") {
  const unit = repeatUnitFromRecurrence(rule);
  const preset = presetFromRecurrence(rule);
  const built = buildRecurrenceInput({
    preset,
    startDate: dtstart,
    customInterval: rule.interval ?? 1,
    customUnit: unit,
    customWeekdays: rule.weekdays ?? [],
    end: rule.until_date ? "date" : rule.occurrence_limit ? "count" : "never",
    untilDate: rule.until_date ?? null,
    occurrenceCount: rule.occurrence_limit ?? 10,
  });
  expect(built).not.toBeNull();
  expect(recurrencesEqual(built!, rule, dtstart)).toBe(true);
  return built!;
}

describe("series edit helpers", () => {
  it("initializes form values from backend detail", () => {
    const values = formValuesFromDetail(DETAIL);
    expect(values.title).toBe("Weekly report");
    expect(values.categoryId).toBe("cat-1");
    expect(values.priority).toBe("medium");
    expect(values.dtstart).toBe("2026-08-21");
    expect(values.durationDays).toBe(1);
    expect(values.preset).toBe("weekly");
    expect(values.end).toBe("never");
    expect(values.content).toEqual(DETAIL.content);
    expect(values.links[0]).toMatchObject({ label: "Docs", url: "https://example.com/docs", position: 0 });
  });

  it("round-trips custom daily, weekly, monthly, and yearly intervals", () => {
    expect(roundTrip({ freq: "daily", interval: 3, weekdays: [] }).freq).toBe("daily");
    expect(roundTrip({ freq: "weekly", interval: 2, weekdays: [0, 2] }).weekdays).toEqual([0, 2]);
    expect(roundTrip({ freq: "monthly", interval: 2, weekdays: [], month_day: 21 }).freq).toBe("monthly");
    const yearly = roundTrip({ freq: "yearly", interval: 2, weekdays: [], month_day: 21 });
    expect(yearly.freq).toBe("yearly");
    expect(yearly.interval).toBe(2);
    expect(repeatUnitFromRecurrence({ freq: "yearly", interval: 2 })).toBe("years");
  });

  it("includes expected_version and only changed fields", () => {
    const values = formValuesFromDetail(DETAIL);
    expect(buildSeriesUpdatePayload(DETAIL, values)).toBeNull();
    const payload = buildSeriesUpdatePayload(DETAIL, { ...values, title: "Renamed", priority: "high" });
    expect(payload).toEqual({
      expected_version: 4,
      title: "Renamed",
      priority: "high",
    });
  });

  it("omits default_column_id when an unavailable status is left unchanged", () => {
    const detail = { ...DETAIL, default_column_id: "col-old" };
    const values = formValuesFromDetail(detail);
    expect(values.columnChoice).toBe("col-old");
    expect(buildSeriesUpdatePayload(detail, { ...values, title: "Renamed" })).toEqual({
      expected_version: 4,
      title: "Renamed",
    });
  });

  it("sends null default_column_id when switching to automatic", () => {
    const values = formValuesFromDetail(DETAIL);
    const payload = buildSeriesUpdatePayload(DETAIL, { ...values, columnChoice: AUTOMATIC_COLUMN });
    expect(payload).toEqual({ expected_version: 4, default_column_id: null });
  });

  it("does not treat equivalent monthly month_day as a change", () => {
    const values = formValuesFromDetail({ ...DETAIL, freq: "monthly", weekdays: [], month_day: 21 });
    expect(buildSeriesUpdatePayload({ ...DETAIL, freq: "monthly", weekdays: [], month_day: 21 }, values)).toBeNull();
  });

  it("compares links without using database ids", () => {
    const values = formValuesFromDetail(DETAIL);
    values.links = [{ id: "other-id", label: "Docs", url: "https://example.com/docs", position: 0 }];
    expect(buildSeriesUpdatePayload(DETAIL, values)).toBeNull();
    values.links = [{ label: "Docs", url: "https://example.com/other", position: 0 }];
    expect(buildSeriesUpdatePayload(DETAIL, values)?.links).toEqual([
      { label: "Docs", url: "https://example.com/other", position: 0 },
    ]);
  });

  it("validates required title, category, duration, and weekly custom days", () => {
    const values = formValuesFromDetail(DETAIL);
    expect(validateSeriesEditForm({ ...values, title: "  " }).title).toBeDefined();
    expect(validateSeriesEditForm({ ...values, categoryId: null }).category).toBeDefined();
    expect(validateSeriesEditForm({ ...values, durationDays: -1 }).duration).toBeDefined();
    expect(
      validateSeriesEditForm({
        ...values,
        preset: "custom",
        customUnit: "weeks",
        customWeekdays: [],
      }).weekdays,
    ).toBeDefined();
    expect(validateSeriesEditForm({ ...values, end: "date", untilDate: "2026-08-01" }).until).toBeDefined();
  });

  it("keeps series recurrence input comparable after form conversion", () => {
    const input = seriesToRecurrenceInput(DETAIL);
    const values = formValuesFromDetail(DETAIL);
    const built = buildRecurrenceInput({
      preset: values.preset,
      startDate: values.dtstart,
      customInterval: values.customInterval,
      customUnit: values.customUnit,
      customWeekdays: values.customWeekdays,
      end: values.end,
      untilDate: values.untilDate,
      occurrenceCount: values.occurrenceCount,
    });
    expect(built).not.toBeNull();
    expect(recurrencesEqual(built!, input, values.dtstart)).toBe(true);
  });
});
