import { parseTimeToMinutes } from "./schedule-time";
import type { ScheduleEntry } from "../types";

export interface LaidOutEntry {
  entry: ScheduleEntry;
  startMin: number;
  endMin: number;
  lane: number;
  laneCount: number;
}

export function entriesForDay(entries: ScheduleEntry[], weekday: number): ScheduleEntry[] {
  return entries.filter((entry) => entry.weekdays.includes(weekday));
}

export function assignLanes(entries: ScheduleEntry[]): LaidOutEntry[] {
  const timed = entries
    .map((entry) => ({
      entry,
      startMin: parseTimeToMinutes(entry.start_time),
      endMin: parseTimeToMinutes(entry.end_time),
    }))
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  const laneEnds: number[] = [];
  const withLanes = timed.map((item) => {
    let lane = laneEnds.findIndex((end) => end <= item.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.endMin);
    } else {
      laneEnds[lane] = item.endMin;
    }
    return { ...item, lane };
  });

  return withLanes.map((item) => {
    const overlapping = withLanes.filter(
      (other) => other.startMin < item.endMin && other.endMin > item.startMin,
    );
    const laneCount = Math.max(...overlapping.map((other) => other.lane)) + 1;
    return { ...item, laneCount };
  });
}
