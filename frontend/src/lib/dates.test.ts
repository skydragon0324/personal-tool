import { describe, expect, it } from "vitest";

import { formatDisplayDate, formatLongDate, formatTaskPeriod, greetingForName } from "./dates";

describe("en-US date formatting", () => {
  it("formats card dates with weekday and month names", () => {
    expect(formatDisplayDate("2026-08-19")).toBe("Wed, Aug 19");
  });

  it("formats long dates in English", () => {
    expect(formatLongDate("2026-08-01")).toBe("Aug 1, 2026");
  });

  it("shows one date when the task period is a single day", () => {
    expect(formatTaskPeriod("2026-08-20", "2026-08-20")).toBe("Thu, Aug 20");
  });

  it("shows start and due when the period spans days", () => {
    expect(formatTaskPeriod("2026-08-18", "2026-08-22")).toBe("Tue, Aug 18 – Sat, Aug 22");
  });

  it("greets by time of day", () => {
    expect(greetingForName("Ada", 8)).toBe("Good morning, Ada");
    expect(greetingForName("Ada", 13)).toBe("Good afternoon, Ada");
    expect(greetingForName("Ada", 20)).toBe("Good evening, Ada");
  });
});
