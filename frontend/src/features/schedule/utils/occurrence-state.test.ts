import { describe, expect, it } from "vitest";

import { isOccurrenceCompleted, occurrenceKey } from "./occurrence-state";

describe("occurrence state helpers", () => {
  it("treats completion as per entry and date", () => {
    const occurrences = [
      {
        schedule_entry_id: "entry-1",
        occurrence_date: "2026-08-17",
        is_completed: true,
      },
      {
        schedule_entry_id: "entry-1",
        occurrence_date: "2026-08-18",
        is_completed: false,
      },
    ];
    expect(occurrenceKey("entry-1", "2026-08-17")).toBe("entry-1:2026-08-17");
    expect(isOccurrenceCompleted(occurrences, "entry-1", "2026-08-17")).toBe(true);
    expect(isOccurrenceCompleted(occurrences, "entry-1", "2026-08-18")).toBe(false);
    expect(isOccurrenceCompleted(occurrences, "entry-1", "2026-08-19")).toBe(false);
  });
});
