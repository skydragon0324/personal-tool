import { describe, expect, it } from "vitest";

import { recurrenceKeys } from "./recurrence-queries";

describe("recurrence query keys", () => {
  it("changes when status, board, or page changes", () => {
    const base = recurrenceKeys.list({ status: "active", offset: 0, limit: 25 });
    expect(recurrenceKeys.list({ status: "stopped", offset: 0, limit: 25 })).not.toEqual(base);
    expect(recurrenceKeys.list({ status: "active", board_id: "board-1", offset: 0, limit: 25 })).not.toEqual(
      base,
    );
    expect(recurrenceKeys.list({ status: "active", offset: 25, limit: 25 })).not.toEqual(base);
    expect(recurrenceKeys.list({ status: "active", offset: 0, limit: 50 })).not.toEqual(base);
  });

  it("has a detail key per series", () => {
    expect(recurrenceKeys.detail("series-1")).toEqual(["recurrence-series", "detail", "series-1"]);
    expect(recurrenceKeys.detail("series-2")).not.toEqual(recurrenceKeys.detail("series-1"));
  });
});
