import { calendarKeys } from "../api/calendar-queries";
import type { CalendarTask } from "../types";
import { rescheduleFromDrop } from "./calendar-dnd";
import {
  addDays,
  daysBetween,
  daysInRange,
  groupByDay,
  rescheduledDates,
  shiftAnchor,
  visibleRange,
} from "./calendar-range";

const task = (extra: Partial<CalendarTask> = {}): CalendarTask => ({
  id: "t1",
  title: "Ship",
  start_date: "2026-08-10",
  due_date: "2026-08-12",
  is_done: false,
  priority: "medium",
  board_id: "b1",
  board_name: "Work",
  board_color: "blue",
  status_id: "s1",
  status_name: "Todo",
  ...extra,
});

describe("visibleRange", () => {
  it("covers the six-week month grid, including days from the months around it", () => {
    // August 2026 starts on a Saturday: the grid starts on Monday July 27.
    const range = visibleRange("month", "2026-08-14");
    expect(range).toEqual({ start: "2026-07-27", end: "2026-09-06" });
    expect(daysInRange(range)).toHaveLength(42);
  });

  it("starts a month on its first day when the 1st is a Monday", () => {
    expect(visibleRange("month", "2027-02-10")).toEqual({ start: "2027-02-01", end: "2027-03-14" });
  });

  it("covers Monday to Sunday for the week view", () => {
    expect(visibleRange("week", "2026-08-20")).toEqual({ start: "2026-08-17", end: "2026-08-23" });
    expect(visibleRange("week", "2026-08-23")).toEqual({ start: "2026-08-17", end: "2026-08-23" });
    expect(visibleRange("week", "2026-12-30")).toEqual({ start: "2026-12-28", end: "2027-01-03" });
  });

  it("lists only the month itself in the agenda and on small screens", () => {
    expect(visibleRange("agenda", "2026-08-14")).toEqual({ start: "2026-08-01", end: "2026-08-31" });
    expect(visibleRange("month", "2026-02-14", true)).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(visibleRange("week", "2026-08-20", true)).toEqual({ start: "2026-08-17", end: "2026-08-23" });
  });
});

describe("calendar query keys", () => {
  it("include the exact range and board", () => {
    expect(calendarKeys.range({ start: "2026-07-27", end: "2026-09-06" }, null)).toEqual([
      "dashboard",
      "calendar",
      "2026-07-27",
      "2026-09-06",
      "all",
    ]);
    expect(calendarKeys.range({ start: "2026-08-17", end: "2026-08-23" }, "b1")).toEqual([
      "dashboard",
      "calendar",
      "2026-08-17",
      "2026-08-23",
      "b1",
    ]);
  });
});

describe("date helpers", () => {
  it("moves the anchor by a month or a week", () => {
    expect(shiftAnchor("month", "2026-01-31", 1)).toBe("2026-02-01");
    expect(shiftAnchor("agenda", "2026-01-15", -1)).toBe("2025-12-01");
    expect(shiftAnchor("week", "2026-08-20", 1)).toBe("2026-08-27");
  });

  it("counts whole days across daylight saving changes", () => {
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
    expect(daysBetween("2026-08-12", "2026-08-10")).toBe(-2);
  });

  it("keeps a task's length when it moves", () => {
    expect(rescheduledDates(task(), "2026-08-20")).toEqual({ start_date: "2026-08-18", due_date: "2026-08-20" });
    expect(rescheduledDates(task({ start_date: "2026-08-12" }), "2026-08-01")).toEqual({
      start_date: "2026-08-01",
      due_date: "2026-08-01",
    });
  });

  it("groups tasks by due day in server order", () => {
    const map = groupByDay([task({ id: "a" }), task({ id: "b", due_date: "2026-08-13" }), task({ id: "c" })]);
    expect(map.get("2026-08-12")?.map((item) => item.id)).toEqual(["a", "c"]);
    expect(map.get("2026-08-13")?.map((item) => item.id)).toEqual(["b"]);
  });
});

describe("rescheduleFromDrop", () => {
  it("returns the new day for a drop on another day", () => {
    expect(rescheduleFromDrop({ task: task() }, { day: "2026-08-14" })).toEqual({ task: task(), dueDate: "2026-08-14" });
  });

  it("ignores canceled drags, the same day and unknown targets", () => {
    expect(rescheduleFromDrop({ task: task() }, { day: "2026-08-14" }, true)).toBeNull();
    expect(rescheduleFromDrop({ task: task() }, { day: "2026-08-12" })).toBeNull();
    expect(rescheduleFromDrop({ task: task() }, { folderId: "x" })).toBeNull();
    expect(rescheduleFromDrop({ boardId: "x" }, { day: "2026-08-14" })).toBeNull();
  });
});
