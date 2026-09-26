import { describe, expect, it } from "vitest";

import type { PlanDay, PlanDetail, PlanItem } from "../types";
import { patchItem, removeDay, removeItem, summaryFromDetail, upsertDay, upsertItem } from "./plan-cache";
import { formatPlanDay, formatPlanRange, nextPlanDay } from "./plan-dates";

function item(id: string, dayId: string, position: number, done = false): PlanItem {
  return {
    id,
    day_id: dayId,
    title: id,
    is_completed: done,
    completed_at: done ? "2026-09-23T10:00:00Z" : null,
    position,
    created_at: "2026-09-23T09:00:00Z",
    updated_at: "2026-09-23T09:00:00Z",
  };
}

function day(id: string, date: string, items: PlanItem[] = []): PlanDay {
  return {
    id,
    plan_id: "plan-1",
    day: date,
    title: "",
    items,
    created_at: "2026-09-23T09:00:00Z",
    updated_at: "2026-09-23T09:00:00Z",
  };
}

function plan(days: PlanDay[]): PlanDetail {
  return {
    id: "plan-1",
    name: "Learning Plan",
    description: "",
    position: 0,
    day_count: 0,
    item_count: 0,
    completed_count: 0,
    first_day: null,
    last_day: null,
    created_at: "2026-09-23T09:00:00Z",
    updated_at: "2026-09-23T09:00:00Z",
    days,
  };
}

describe("plan cache", () => {
  const base = plan([
    day("d1", "2026-09-23", [item("react", "d1", 0, true), item("read", "d1", 1)]),
    day("d2", "2026-09-24", [item("redux", "d2", 0)]),
  ]);

  it("toggles an item and keeps counts in sync", () => {
    const next = patchItem(base, "read", { is_completed: true });
    expect(next.days[0].items[1].is_completed).toBe(true);
    expect(next.days[0].items[1].completed_at).not.toBeNull();
    expect(next.completed_count).toBe(2);
    expect(next.item_count).toBe(3);

    const unchecked = patchItem(next, "react", { is_completed: false });
    expect(unchecked.days[0].items[0].completed_at).toBeNull();
    expect(unchecked.completed_count).toBe(1);
  });

  it("adds items in position order and removes them", () => {
    const added = upsertItem(base, item("project", "d2", 1));
    expect(added.days[1].items.map((entry) => entry.id)).toEqual(["redux", "project"]);
    expect(added.item_count).toBe(4);
    expect(removeItem(added, "redux").days[1].items.map((entry) => entry.id)).toEqual(["project"]);
  });

  it("keeps days sorted by date", () => {
    const added = upsertDay(base, day("d0", "2026-09-22"));
    expect(added.days.map((entry) => entry.day)).toEqual(["2026-09-22", "2026-09-23", "2026-09-24"]);
    expect(added.first_day).toBe("2026-09-22");
    expect(added.last_day).toBe("2026-09-24");

    const moved = upsertDay(added, { ...added.days[0], day: "2026-09-30" });
    expect(moved.days.map((entry) => entry.id)).toEqual(["d1", "d2", "d0"]);

    const removed = removeDay(moved, "d1");
    expect(removed.day_count).toBe(2);
    expect(removed.item_count).toBe(1);
  });

  it("strips days from the list summary", () => {
    expect(summaryFromDetail(base)).not.toHaveProperty("days");
  });
});

describe("plan dates", () => {
  it("formats day headings like Monday, September 21", () => {
    expect(formatPlanDay("2026-09-21", "2026-09-23")).toBe("Monday, September 21");
    expect(formatPlanDay("2027-01-04", "2026-09-23")).toBe("Monday, January 4, 2027");
  });

  it("suggests the day after the last one", () => {
    expect(nextPlanDay([], "2026-09-23")).toBe("2026-09-23");
    expect(nextPlanDay(["2026-09-24", "2026-09-30"], "2026-09-23")).toBe("2026-10-01");
  });

  it("formats ranges", () => {
    expect(formatPlanRange(null, null)).toBeNull();
    expect(formatPlanRange("2026-09-23", "2026-09-23")).toBe("Sep 23");
    expect(formatPlanRange("2026-09-23", "2026-09-26")).toBe("Sep 23 – Sep 26");
  });
});
