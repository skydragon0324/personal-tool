import { describe, expect, it } from "vitest";

import { scheduleTimeStatus } from "./schedule-status";

describe("schedule time status", () => {
  const date = "2026-08-20";
  const now = new Date(2026, 7, 20, 10, 0, 0);

  it("marks completed entries even when the time window is current", () => {
    expect(
      scheduleTimeStatus({
        date,
        startTime: "09:00:00",
        endTime: "11:00:00",
        isCompleted: true,
        now,
      }),
    ).toBe("completed");
  });

  it("returns upcoming, in progress, and passed from the clock", () => {
    expect(
      scheduleTimeStatus({
        date,
        startTime: "11:00:00",
        endTime: "12:00:00",
        isCompleted: false,
        now,
      }),
    ).toBe("upcoming");
    expect(
      scheduleTimeStatus({
        date,
        startTime: "09:00:00",
        endTime: "11:00:00",
        isCompleted: false,
        now,
      }),
    ).toBe("in_progress");
    expect(
      scheduleTimeStatus({
        date,
        startTime: "08:00:00",
        endTime: "09:00:00",
        isCompleted: false,
        now,
      }),
    ).toBe("passed");
  });
});
