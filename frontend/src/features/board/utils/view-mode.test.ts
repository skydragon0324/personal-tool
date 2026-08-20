import { describe, expect, it } from "vitest";

import { isViewMode } from "./view-mode";

describe("view mode", () => {
  it("accepts the three current modes", () => {
    expect(isViewMode("board")).toBe(true);
    expect(isViewMode("table")).toBe(true);
    expect(isViewMode("progress")).toBe(true);
    expect(isViewMode("calendar")).toBe(false);
  });
});
