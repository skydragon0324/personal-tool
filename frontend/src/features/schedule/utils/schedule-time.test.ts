import { describe, expect, it } from "vitest";

import type { ScheduleEntry } from "../types";
import { assignLanes, entriesForDay, entriesForIsoDate } from "./schedule-layout";
import { mondayOf, minutesToTime, parseTimeToMinutes, shiftIso, weekdayIndex } from "./schedule-time";

function entry(partial: Partial<ScheduleEntry> & Pick<ScheduleEntry, "id" | "title" | "start_time" | "end_time">): ScheduleEntry {
  return {
    kind: "routine",
    weekdays: [0],
    week_start: null,
    priority: null,
    color: "teal",
    notes: "",
    created_at: "2026-08-19T00:00:00Z",
    updated_at: "2026-08-19T00:00:00Z",
    ...partial,
  };
}

describe("schedule time helpers", () => {
  it("uses Monday as the start of the week", () => {
    expect(mondayOf("2026-08-19")).toBe("2026-08-17");
    expect(weekdayIndex("2026-08-19")).toBe(2);
    expect(shiftIso("2026-08-19", "week", -1)).toBe("2026-08-12");
    expect(parseTimeToMinutes("09:30:00")).toBe(570);
    expect(minutesToTime(570)).toBe("09:30:00");
  });
});

describe("schedule overlap lanes", () => {
  it("places overlapping entries in adjacent lanes and keeps non-overlapping items stacked", () => {
    const items = [
      entry({ id: "a", title: "A", start_time: "10:00:00", end_time: "11:00:00" }),
      entry({ id: "b", title: "B", start_time: "10:30:00", end_time: "11:30:00" }),
      entry({ id: "c", title: "C", start_time: "12:00:00", end_time: "13:00:00" }),
    ];
    const laidOut = assignLanes(items);
    const byId = Object.fromEntries(laidOut.map((item) => [item.entry.id, item]));
    expect(byId.a.lane).toBe(0);
    expect(byId.b.lane).toBe(1);
    expect(byId.a.laneCount).toBe(2);
    expect(byId.b.laneCount).toBe(2);
    expect(byId.c.lane).toBe(0);
    expect(byId.c.laneCount).toBe(1);
    expect(entriesForDay(items, 1)).toEqual([]);
    expect(
      entriesForIsoDate(
        [
          ...items,
          entry({ id: "d", title: "D", start_time: "08:00:00", end_time: "09:00:00", weekdays: [2] }),
        ],
        "2026-08-19",
      ).map((item) => item.id),
    ).toEqual(["d"]);
  });
});
