import { describe, expect, it } from "vitest";

import { applyRangeChange, commitCustomRange, normalizeCustomDraft } from "./board-range";

describe("custom date range", () => {
  const applied: [string | null, string | null] = ["2026-08-19", "2026-08-19"];

  it("keeps [start, null] on the picker without applying it", () => {
    const result = applyRangeChange(["2026-08-20", null], applied);
    expect(result.pickerRange).toEqual(["2026-08-20", null]);
    expect(result.appliedRange).toEqual(applied);
  });

  it("does not apply after the second date is chosen until Apply", () => {
    const result = applyRangeChange(["2026-08-20", "2026-08-22"], applied);
    expect(result.pickerRange).toEqual(["2026-08-20", "2026-08-22"]);
    expect(result.appliedRange).toEqual(applied);
  });

  it("does not force start and end to the same date on the first click", () => {
    expect(normalizeCustomDraft(["2026-08-20", "2026-08-20"], [null, null])).toEqual([
      "2026-08-20",
      null,
    ]);
    expect(
      normalizeCustomDraft(["2026-08-01", "2026-08-01"], ["2026-07-01", "2026-07-31"]),
    ).toEqual(["2026-08-01", null]);
  });

  it("allows the same date as start and end on the second click", () => {
    expect(normalizeCustomDraft(["2026-08-20", "2026-08-20"], ["2026-08-20", null])).toEqual([
      "2026-08-20",
      "2026-08-20",
    ]);
  });

  it("lets a new range start without changing the current query", () => {
    const current: [string | null, string | null] = ["2026-08-20", "2026-08-22"];
    const result = applyRangeChange(["2026-08-01", null], current);
    expect(result.pickerRange).toEqual(["2026-08-01", null]);
    expect(result.appliedRange).toEqual(current);
  });

  it("applies a complete custom range with Apply", () => {
    expect(commitCustomRange(["2026-08-21", "2026-08-21"])).toEqual({
      ok: true,
      range: ["2026-08-21", "2026-08-21"],
    });
  });

  it("rejects Apply when the start date is after the end date", () => {
    expect(commitCustomRange(["2026-08-22", "2026-08-20"])).toEqual({
      ok: false,
      error: "Start date must be on or before the end date",
    });
  });

  it("rejects Apply when a date is still missing", () => {
    expect(commitCustomRange(["2026-08-20", null]).ok).toBe(false);
    expect(commitCustomRange([null, null]).ok).toBe(false);
  });
});
