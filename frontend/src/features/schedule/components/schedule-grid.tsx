"use client";

import { Checkbox } from "@mantine/core";

import { statusHeaderClass } from "@/features/board/utils/status-colors";

import type { ScheduleEntry, ScheduleOccurrence } from "../types";
import { assignLanes, entriesForDay } from "../utils/schedule-layout";
import { isOccurrenceCompleted, occurrenceKey } from "../utils/occurrence-state";
import {
  SLOT_MINUTES,
  SLOTS_PER_DAY,
  WEEKDAY_LABELS,
  formatTimeLabel,
  minutesToTime,
  slotCount,
  slotStartMinutes,
  timeToSlot,
  weekdayIndex,
} from "../utils/schedule-time";

interface ScheduleGridProps {
  view: "day" | "week";
  dates: string[];
  entries: ScheduleEntry[];
  occurrences: ScheduleOccurrence[];
  pendingKey?: string | null;
  onSlotClick: (weekday: number, startTime: string, endTime: string) => void;
  onEntryClick: (entry: ScheduleEntry) => void;
  onToggleComplete: (entry: ScheduleEntry, occurrenceDate: string, isCompleted: boolean) => void;
}

export function ScheduleGrid({
  view,
  dates,
  entries,
  occurrences,
  pendingKey,
  onSlotClick,
  onEntryClick,
  onToggleComplete,
}: ScheduleGridProps) {
  const columns = view === "day" ? 1 : 7;
  const visibleDates = view === "day" ? dates.slice(0, 1) : dates;

  return (
    <div className="overflow-auto rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]">
      <div
        className="grid min-w-[720px]"
        style={{
          gridTemplateColumns: `4.5rem repeat(${columns}, minmax(0, 1fr))`,
        }}
      >
        <div className="sticky top-0 z-10 border-b border-[var(--app-border)] bg-[var(--app-surface)]" />
        {visibleDates.map((iso, index) => (
          <div
            key={iso}
            className="sticky top-0 z-10 border-b border-l border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-2 text-center text-sm font-medium text-[var(--app-text)]"
          >
            {WEEKDAY_LABELS[view === "day" ? weekdayIndex(iso) : index]}
            <div className="text-xs font-normal text-[var(--app-text-muted)]">{iso.slice(5)}</div>
          </div>
        ))}
        {Array.from({ length: SLOTS_PER_DAY }, (_, slot) => (
          <SlotRow
            key={slot}
            slot={slot}
            dates={visibleDates}
            entries={entries}
            occurrences={occurrences}
            pendingKey={pendingKey}
            onSlotClick={onSlotClick}
            onEntryClick={onEntryClick}
            onToggleComplete={onToggleComplete}
          />
        ))}
      </div>
    </div>
  );
}

function SlotRow({
  slot,
  dates,
  entries,
  occurrences,
  pendingKey,
  onSlotClick,
  onEntryClick,
  onToggleComplete,
}: {
  slot: number;
  dates: string[];
  entries: ScheduleEntry[];
  occurrences: ScheduleOccurrence[];
  pendingKey?: string | null;
  onSlotClick: (weekday: number, startTime: string, endTime: string) => void;
  onEntryClick: (entry: ScheduleEntry) => void;
  onToggleComplete: (entry: ScheduleEntry, occurrenceDate: string, isCompleted: boolean) => void;
}) {
  const start = minutesToTime(slotStartMinutes(slot));
  const end = minutesToTime(slotStartMinutes(slot) + SLOT_MINUTES);
  const showLabel = slot % 2 === 0;

  return (
    <>
      <div className="border-t border-[var(--app-border)] px-2 py-1 text-right text-xs text-[var(--app-text-muted)]">
        {showLabel ? formatTimeLabel(start) : ""}
      </div>
      {dates.map((iso) => {
        const weekday = weekdayIndex(iso);
        const laidOut = assignLanes(entriesForDay(entries, weekday));
        const starting = laidOut.filter((item) => timeToSlot(item.entry.start_time) === slot);
        return (
          <div
            key={`${iso}-${slot}`}
            className="relative min-h-[28px] border-l border-t border-[var(--app-border)]"
          >
            <button
              type="button"
              aria-label={`Add schedule at ${formatTimeLabel(start)} on ${WEEKDAY_LABELS[weekday]}`}
              onClick={() => onSlotClick(weekday, start, end)}
              className="absolute inset-0 hover:bg-[var(--app-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--app-primary)]"
            />
            {starting.map((item) => {
              const completed = isOccurrenceCompleted(occurrences, item.entry.id, iso);
              const key = occurrenceKey(item.entry.id, iso);
              return (
                <div
                  key={key}
                  className={`absolute top-0 z-[1] flex items-start gap-1 overflow-hidden rounded-md px-1 py-0.5 text-left text-[11px] font-medium text-white ${statusHeaderClass(item.entry.color)} ${
                    completed ? "opacity-55" : ""
                  }`}
                  style={{
                    left: `calc(${(item.lane / item.laneCount) * 100}% + 2px)`,
                    width: `calc(${100 / item.laneCount}% - 4px)`,
                    height: `calc(${slotCount(item.entry.start_time, item.entry.end_time)} * 100% - 2px)`,
                  }}
                >
                  <Checkbox
                    size="xs"
                    checked={completed}
                    disabled={pendingKey === key}
                    aria-label={
                      completed
                        ? `Mark ${item.entry.title} incomplete on ${iso}`
                        : `Mark ${item.entry.title} complete on ${iso}`
                    }
                    onChange={(event) =>
                      onToggleComplete(item.entry, iso, event.currentTarget.checked)
                    }
                    onClick={(event) => event.stopPropagation()}
                    className="mt-px shrink-0"
                  />
                  <button
                    type="button"
                    onClick={() => onEntryClick(item.entry)}
                    className="min-w-0 flex-1 truncate text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                  >
                    <span className={completed ? "line-through" : undefined}>{item.entry.title}</span>
                    {completed ? <span className="sr-only">Completed</span> : null}
                  </button>
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}
