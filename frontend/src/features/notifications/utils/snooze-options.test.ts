import { describe, expect, it } from "vitest";

import { snoozeOptions } from "./snooze-options";

describe("snoozeOptions", () => {
  it("offers later today, tomorrow morning and next Monday", () => {
    // Wednesday 2026-09-23 14:30 local time.
    const now = new Date(2026, 8, 23, 14, 30);
    const [hour, threeHours, tomorrow, monday] = snoozeOptions(now);
    expect(hour.at.getTime() - now.getTime()).toBe(60 * 60 * 1000);
    expect(threeHours.at.getTime() - now.getTime()).toBe(3 * 60 * 60 * 1000);
    expect([tomorrow.at.getDate(), tomorrow.at.getHours()]).toEqual([24, 9]);
    expect([monday.at.getDay(), monday.at.getDate(), monday.at.getHours()]).toEqual([1, 28, 9]);
  });

  it("goes to the following Monday when today is Monday", () => {
    const monday = new Date(2026, 8, 28, 8, 0);
    expect(snoozeOptions(monday)[3].at.getDate()).toBe(5);
  });
});
