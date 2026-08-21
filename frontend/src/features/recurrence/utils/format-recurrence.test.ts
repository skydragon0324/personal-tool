import { describe, expect, it } from "vitest";

import { formatRecurrenceRule } from "./format-recurrence";

describe("formatRecurrenceRule", () => {
  it("formats daily, weekday, weekly, monthly, and yearly rules", () => {
    expect(
      formatRecurrenceRule({
        freq: "daily",
        interval: 1,
        weekdays: [],
        month_day: null,
        start_date: "2026-08-21",
        end_date: null,
        occurrence_limit: null,
      }),
    ).toBe("Daily");
    expect(
      formatRecurrenceRule({
        freq: "daily",
        interval: 3,
        weekdays: [],
        month_day: null,
        start_date: "2026-08-21",
        end_date: null,
        occurrence_limit: null,
      }),
    ).toBe("Every 3 days");
    expect(
      formatRecurrenceRule({
        freq: "weekly",
        interval: 1,
        weekdays: [0, 1, 2, 3, 4],
        month_day: null,
        start_date: "2026-08-21",
        end_date: null,
        occurrence_limit: null,
      }),
    ).toBe("Weekdays");
    expect(
      formatRecurrenceRule({
        freq: "weekly",
        interval: 1,
        weekdays: [0, 2],
        month_day: null,
        start_date: "2026-08-21",
        end_date: null,
        occurrence_limit: null,
      }),
    ).toBe("Weekly on Monday and Wednesday");
    expect(
      formatRecurrenceRule({
        freq: "monthly",
        interval: 1,
        weekdays: [],
        month_day: 15,
        start_date: "2026-01-15",
        end_date: null,
        occurrence_limit: null,
      }),
    ).toBe("Monthly on day 15");
    expect(
      formatRecurrenceRule({
        freq: "yearly",
        interval: 1,
        weekdays: [],
        month_day: 29,
        start_date: "2024-02-29",
        end_date: null,
        occurrence_limit: null,
      }),
    ).toBe("Yearly on February 29");
  });

  it("appends end date and occurrence limit", () => {
    expect(
      formatRecurrenceRule({
        freq: "weekly",
        interval: 1,
        weekdays: [4],
        month_day: null,
        start_date: "2026-08-21",
        end_date: "2026-12-31",
        occurrence_limit: 12,
      }),
    ).toBe("Weekly on Friday · until Dec 31, 2026 · 12 occurrences");
  });
});
