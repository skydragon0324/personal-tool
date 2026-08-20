import { describe, expect, it } from "vitest";

import {
  dateInRange,
  DEFAULT_FILTERS,
  formatMonthLabel,
  formatWeekRangeLabel,
  formatYearLabel,
  migrateDateRangeMode,
  monthRange,
  next30Range,
  rangeForMode,
  weekRange,
  yearRange,
} from "./date-presets";

describe("date range modes", () => {
  it("uses the current month as the default range", () => {
    expect(rangeForMode("month", "2026-08-19")).toEqual(["2026-08-01", "2026-08-31"]);
    expect(monthRange("2026-08-13")).toEqual(["2026-08-01", "2026-08-31"]);
    expect(DEFAULT_FILTERS.rangeMode).toBe("month");
  });

  it("builds a full calendar year including leap years", () => {
    expect(yearRange(2026)).toEqual(["2026-01-01", "2026-12-31"]);
    expect(yearRange(2024)).toEqual(["2024-01-01", "2024-12-31"]);
    expect(rangeForMode("year", "2024-06-01")).toEqual(["2024-01-01", "2024-12-31"]);
    expect(dateInRange("2024-02-29", "2024-01-01", "2024-12-31", false)).toBe(true);
  });

  it("uses the first and last day of each month, including February in a leap year", () => {
    expect(monthRange("2026-01-15")).toEqual(["2026-01-01", "2026-01-31"]);
    expect(monthRange("2024-02-10")).toEqual(["2024-02-01", "2024-02-29"]);
    expect(monthRange("2025-02-10")).toEqual(["2025-02-01", "2025-02-28"]);
    expect(monthRange("2026-04-01")).toEqual(["2026-04-01", "2026-04-30"]);
  });

  it("selects Monday–Sunday weeks and spans years", () => {
    expect(weekRange("2026-08-19")).toEqual(["2026-08-17", "2026-08-23"]);
    expect(weekRange("2026-08-17")).toEqual(["2026-08-17", "2026-08-23"]);
    expect(weekRange("2026-08-23")).toEqual(["2026-08-17", "2026-08-23"]);
    expect(weekRange("2026-01-01")).toEqual(["2025-12-29", "2026-01-04"]);
  });

  it("uses a single day for day mode and no dates for all", () => {
    expect(rangeForMode("day", "2026-03-08")).toEqual(["2026-03-08", "2026-03-08"]);
    expect(rangeForMode("all", "2026-08-19")).toEqual([null, null]);
  });

  it("formats year, month, and week labels", () => {
    expect(formatYearLabel("2026-08-19")).toBe("2026");
    expect(formatMonthLabel("2026-08-19")).toBe("August 2026");
    expect(formatWeekRangeLabel("2026-08-17", "2026-08-23")).toBe("Aug 17 – Aug 23, 2026");
    expect(formatWeekRangeLabel("2025-12-29", "2026-01-04")).toBe("Dec 29, 2025 – Jan 4, 2026");
  });

  it("migrates previous localStorage presets", () => {
    expect(migrateDateRangeMode("today")).toBe("day");
    expect(migrateDateRangeMode("this_week")).toBe("week");
    expect(migrateDateRangeMode("this_month")).toBe("month");
    expect(migrateDateRangeMode("next_30")).toBe("custom");
    expect(migrateDateRangeMode("custom")).toBe("custom");
    expect(migrateDateRangeMode("all")).toBe("all");
    expect(next30Range("2026-08-19")).toEqual(["2026-08-19", "2026-09-17"]);
  });
});
