import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

import type { ScheduleEntry, ScheduleOccurrence } from "../types";
import { ScheduleGrid } from "./schedule-grid";

const entry: ScheduleEntry = {
  id: "entry-1",
  title: "Morning stretch",
  kind: "routine",
  weekdays: [0, 1],
  week_start: null,
  start_time: "08:00:00",
  end_time: "08:30:00",
  priority: "medium",
  color: "teal",
  notes: "",
  created_at: "2026-08-17T00:00:00Z",
  updated_at: "2026-08-17T00:00:00Z",
};

const weekDates = [
  "2026-08-17",
  "2026-08-18",
  "2026-08-19",
  "2026-08-20",
  "2026-08-21",
  "2026-08-22",
  "2026-08-23",
];

function renderGrid({
  view = "week",
  dates = weekDates,
  occurrences = [],
  onToggleComplete = vi.fn(),
  onEntryClick = vi.fn(),
  onSlotClick = vi.fn(),
  pendingKey = null,
}: {
  view?: "day" | "week";
  dates?: string[];
  occurrences?: ScheduleOccurrence[];
  onToggleComplete?: (entry: ScheduleEntry, occurrenceDate: string, isCompleted: boolean) => void;
  onEntryClick?: (entry: ScheduleEntry) => void;
  onSlotClick?: (weekday: number, startTime: string, endTime: string) => void;
  pendingKey?: string | null;
} = {}) {
  render(
    createElement(
      MantineProvider,
      { env: "test" },
      createElement(ScheduleGrid, {
        view,
        dates,
        entries: [entry],
        occurrences,
        pendingKey,
        onSlotClick,
        onEntryClick,
        onToggleComplete,
      }),
    ),
  );
  return { onToggleComplete, onEntryClick, onSlotClick };
}

describe("ScheduleGrid occurrence completion", () => {
  it("shows a completion control in the day view", () => {
    renderGrid({ view: "day", dates: ["2026-08-17"] });
    expect(screen.getByRole("checkbox", { name: "Mark Morning stretch complete on 2026-08-17" })).toBeInTheDocument();
  });

  it("shows a completion control in the week view", () => {
    renderGrid({ view: "week" });
    expect(screen.getByRole("checkbox", { name: "Mark Morning stretch complete on 2026-08-17" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Mark Morning stretch complete on 2026-08-18" })).toBeInTheDocument();
  });

  it("sends Monday’s date when Monday’s occurrence is toggled", async () => {
    const user = userEvent.setup();
    const { onToggleComplete } = renderGrid();
    await user.click(screen.getByRole("checkbox", { name: "Mark Morning stretch complete on 2026-08-17" }));
    expect(onToggleComplete).toHaveBeenCalledWith(entry, "2026-08-17", true);
  });

  it("sends Tuesday’s date when Tuesday’s occurrence is toggled", async () => {
    const user = userEvent.setup();
    const { onToggleComplete } = renderGrid();
    await user.click(screen.getByRole("checkbox", { name: "Mark Morning stretch complete on 2026-08-18" }));
    expect(onToggleComplete).toHaveBeenCalledWith(entry, "2026-08-18", true);
  });

  it("does not mark another weekday complete when only one date is completed", () => {
    renderGrid({
      occurrences: [
        {
          schedule_entry_id: "entry-1",
          occurrence_date: "2026-08-17",
          is_completed: true,
          completed_at: "2026-08-17T08:05:00Z",
        },
      ],
    });
    expect(screen.getByRole("checkbox", { name: "Mark Morning stretch incomplete on 2026-08-17" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Mark Morning stretch complete on 2026-08-18" })).not.toBeChecked();
  });

  it("applies checked and completed styling", () => {
    const { container } = render(
      createElement(
        MantineProvider,
        { env: "test" },
        createElement(ScheduleGrid, {
          view: "day",
          dates: ["2026-08-17"],
          entries: [entry],
          occurrences: [
            {
              schedule_entry_id: "entry-1",
              occurrence_date: "2026-08-17",
              is_completed: true,
              completed_at: "2026-08-17T08:05:00Z",
            },
          ],
          onSlotClick: vi.fn(),
          onEntryClick: vi.fn(),
          onToggleComplete: vi.fn(),
        }),
      ),
    );
    const checkbox = screen.getByRole("checkbox", { name: "Mark Morning stretch incomplete on 2026-08-17" });
    expect(checkbox).toBeChecked();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(container.innerHTML).toContain("line-through");
    expect(container.innerHTML).toContain("opacity-55");
  });

  it("can mark a completed occurrence incomplete", async () => {
    const user = userEvent.setup();
    const { onToggleComplete } = renderGrid({
      occurrences: [
        {
          schedule_entry_id: "entry-1",
          occurrence_date: "2026-08-17",
          is_completed: true,
          completed_at: "2026-08-17T08:05:00Z",
        },
      ],
    });
    await user.click(screen.getByRole("checkbox", { name: "Mark Morning stretch incomplete on 2026-08-17" }));
    expect(onToggleComplete).toHaveBeenCalledWith(entry, "2026-08-17", false);
  });

  it("does not open the editor when the completion control is clicked", async () => {
    const user = userEvent.setup();
    const { onEntryClick, onToggleComplete } = renderGrid();
    await user.click(screen.getByRole("checkbox", { name: "Mark Morning stretch complete on 2026-08-17" }));
    expect(onToggleComplete).toHaveBeenCalled();
    expect(onEntryClick).not.toHaveBeenCalled();
  });

  it("opens the editor when the remaining card area is clicked", async () => {
    const user = userEvent.setup();
    const { onEntryClick } = renderGrid({ view: "day", dates: ["2026-08-17"] });
    await user.click(screen.getByRole("button", { name: /Morning stretch/ }));
    expect(onEntryClick).toHaveBeenCalledWith(entry);
  });
});
