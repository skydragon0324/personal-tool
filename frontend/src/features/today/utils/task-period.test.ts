import { describe, expect, it } from "vitest";

import { isDateInTaskPeriod } from "./task-period";

describe("today task period", () => {
  it("includes both start and due boundary dates", () => {
    expect(isDateInTaskPeriod("2026-08-20", "2026-08-20", "2026-08-22")).toBe(true);
    expect(isDateInTaskPeriod("2026-08-22", "2026-08-20", "2026-08-22")).toBe(true);
    expect(isDateInTaskPeriod("2026-08-21", "2026-08-20", "2026-08-22")).toBe(true);
  });

  it("excludes dates outside the period", () => {
    expect(isDateInTaskPeriod("2026-08-19", "2026-08-20", "2026-08-22")).toBe(false);
    expect(isDateInTaskPeriod("2026-08-23", "2026-08-20", "2026-08-22")).toBe(false);
  });
});
