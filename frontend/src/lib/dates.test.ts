import { describe, expect, it } from "vitest";

import { formatDisplayDate, formatLongDate } from "./dates";

describe("en-US date formatting", () => {
  it("formats card dates with weekday and month names", () => {
    expect(formatDisplayDate("2026-08-19")).toBe("Wed, Aug 19");
  });

  it("formats long dates in English", () => {
    expect(formatLongDate("2026-08-01")).toBe("Aug 1, 2026");
  });
});
