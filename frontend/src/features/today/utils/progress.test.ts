import { describe, expect, it } from "vitest";

import { progressLabel, progressPercent } from "./progress";

describe("today progress", () => {
  it("shows completed over total", () => {
    expect(progressLabel({ total: 4, completed: 1, remaining: 3, percentage: 25 })).toBe("1 / 4");
  });

  it("uses 0% when there are no items", () => {
    expect(progressPercent({ total: 0, completed: 0, remaining: 0, percentage: 0 })).toBe(0);
  });

  it("keeps the API percentage when items exist", () => {
    expect(progressPercent({ total: 2, completed: 1, remaining: 1, percentage: 50 })).toBe(50);
  });
});
