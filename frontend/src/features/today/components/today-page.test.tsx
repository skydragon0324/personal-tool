import { MantineProvider } from "@mantine/core";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TodayResponse } from "../types";
import { TodayPage } from "./today-page";

const { todayQuery, occurrenceMutate, loadNote } = vi.hoisted(() => ({
  todayQuery: {
    isLoading: false,
    isError: false,
    data: null as TodayResponse | null,
    refetch: vi.fn(),
  },
  occurrenceMutate: vi.fn(),
  loadNote: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement("a", { href }, children),
}));

vi.mock("@/lib/dates", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/dates")>();
  return {
    ...actual,
    todayISO: () => "2026-08-20",
  };
});

vi.mock("@/features/auth/components/auth-provider", () => ({
  useAuth: () => ({
    user: { display_name: "Ada", email: "ada@example.com" },
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock("../hooks/use-today", () => ({
  useToday: () => todayQuery,
  useScheduleOccurrence: () => ({
    mutate: occurrenceMutate,
    isPending: false,
    variables: undefined,
  }),
}));

vi.mock("./today-editors", () => ({
  loadNote: (...args: unknown[]) => loadNote(...args),
  TodayTaskDrawer: ({ taskId }: { taskId: string | null }) =>
    taskId ? createElement("div", null, `Task drawer ${taskId}`) : null,
  TodayNoteDrawer: ({ note }: { note: { title: string } | null }) =>
    note ? createElement("div", null, `Note drawer ${note.title}`) : null,
  TodayScheduleEditor: ({ entry }: { entry: { title: string } | null }) =>
    entry ? createElement("div", null, `Schedule editor ${entry.title}`) : null,
}));

const emptyProgress = { total: 0, completed: 0, remaining: 0, percentage: 0 };

function populatedToday(): TodayResponse {
  return {
    date: "2026-08-20",
    task_progress: { total: 2, completed: 1, remaining: 1, percentage: 50 },
    schedule_progress: { total: 1, completed: 0, remaining: 1, percentage: 0 },
    active_tasks: [
      {
        id: "task-open",
        title: "Write brief",
        start_date: "2026-08-20",
        due_date: "2026-08-20",
        priority: "high",
        completed_at: null,
        board_id: "board-work",
        board_name: "Work",
        board_color: "blue",
        board_icon_name: "briefcase",
        status_id: "status-todo",
        status_name: "Todo",
        status_color: "blue",
        status_is_done: false,
        subtask_completed: 1,
        subtask_total: 2,
        deadline_status: "due_today",
      },
      {
        id: "task-done",
        title: "Ship notes",
        start_date: "2026-08-18",
        due_date: "2026-08-22",
        priority: "low",
        completed_at: "2026-08-20T12:00:00Z",
        board_id: "board-home",
        board_name: "Home",
        board_color: "teal",
        board_icon_name: "home",
        status_id: "status-done",
        status_name: "Done",
        status_color: "green",
        status_is_done: true,
        subtask_completed: 0,
        subtask_total: 0,
        deadline_status: "completed",
      },
    ],
    overdue_tasks: [
      {
        id: "task-overdue",
        title: "Pay rent",
        start_date: "2026-08-01",
        due_date: "2026-08-10",
        priority: "high",
        completed_at: null,
        board_id: "board-home",
        board_name: "Home",
        board_color: "teal",
        board_icon_name: "home",
        status_id: "status-todo",
        status_name: "Todo",
        status_color: "blue",
        status_is_done: false,
        subtask_completed: 0,
        subtask_total: 0,
        deadline_status: "overdue",
      },
    ],
    schedules: [
      {
        id: "sched-1",
        title: "Morning walk",
        kind: "routine",
        weekdays: [3],
        week_start: null,
        start_time: "09:00:00",
        end_time: "10:00:00",
        priority: "medium",
        color: "teal",
        notes: "Park loop",
        is_completed: false,
        completed_at: null,
      },
    ],
    pinned_notes: [
      {
        id: "note-1",
        title: "Grocery list",
        preview: "Milk\nEggs",
        priority: "high",
        updated_at: "2026-08-20T09:00:00Z",
      },
    ],
    pinned_notes_total: 7,
  };
}

function wrap(ui: ReactNode) {
  return render(createElement(MantineProvider, { env: "test" }, ui));
}

describe("Today page", () => {
  beforeEach(() => {
    todayQuery.isLoading = false;
    todayQuery.isError = false;
    todayQuery.data = populatedToday();
    todayQuery.refetch.mockReset();
    occurrenceMutate.mockReset();
    loadNote.mockReset();
    loadNote.mockResolvedValue({
      id: "note-1",
      title: "Grocery list",
      body: "Milk\nEggs",
      priority: "high",
      is_pinned: true,
      created_at: "2026-08-19T10:00:00Z",
      updated_at: "2026-08-20T09:00:00Z",
    });
  });

  it("renders a summary strip and four dashboard panels", () => {
    wrap(createElement(TodayPage));
    expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
    expect(screen.getByText("Your tasks, schedule, and pinned notes for today.")).toBeInTheDocument();
    expect(screen.getAllByText("Thursday, August 20, 2026").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Good (morning|afternoon|evening), Ada/)).toBeInTheDocument();
    expect(screen.getByLabelText("Today summary")).toBeInTheDocument();
    expect(screen.getByText("Tasks")).toBeInTheDocument();
    expect(screen.getByText("Schedule")).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(screen.getByText("0 / 1")).toBeInTheDocument();
    expect(screen.getByText("Time blocks planned for today")).toBeInTheDocument();
    expect(screen.getByText("Morning walk")).toBeInTheDocument();
    expect(screen.getByText("Routine")).toBeInTheDocument();
    expect(screen.getByText("Tasks whose active period includes today")).toBeInTheDocument();
    expect(screen.getByText("Write brief")).toBeInTheDocument();
    expect(screen.getByText("Work")).toBeInTheDocument();
    expect(screen.getByText("Ship notes")).toBeInTheDocument();
    expect(screen.getAllByText("Home").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Unfinished tasks past their due date")).toBeInTheDocument();
    expect(screen.getByText("Pay rent")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Active tasks")).queryByText("Pay rent")).not.toBeInTheDocument();
    expect(within(screen.getByLabelText("Needs attention")).getByText("Pay rent")).toBeInTheDocument();
    expect(screen.getByText("Grocery list")).toBeInTheDocument();
    expect(screen.getByText("View all notes")).toBeInTheDocument();
    const grid = screen.getByLabelText("Today dashboard");
    expect(grid.className).toContain("grid-cols-1");
    expect(grid.className).toContain("md:grid-cols-2");
  });

  it("keeps completed tasks visible and dimmed", () => {
    wrap(createElement(TodayPage));
    const done = screen.getByRole("button", { name: /Ship notes/ });
    expect(done).toBeInTheDocument();
    expect(done.className).toContain("opacity-55");
  });

  it("shows empty states with links to the source pages", () => {
    todayQuery.data = {
      date: "2026-08-20",
      task_progress: emptyProgress,
      schedule_progress: emptyProgress,
      active_tasks: [],
      overdue_tasks: [],
      schedules: [],
      pinned_notes: [],
      pinned_notes_total: 0,
    };
    wrap(createElement(TodayPage));
    expect(screen.getAllByText("0 / 0").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("link", { name: "Open schedule" })).toHaveAttribute("href", "/schedule");
    expect(screen.getByRole("link", { name: "Open boards" })).toHaveAttribute("href", "/boards");
    expect(screen.getByRole("link", { name: "Open notepad" })).toHaveAttribute("href", "/notepad");
    expect(screen.getByText("You're all caught up.")).toBeInTheDocument();
  });

  it("toggles schedule completion", async () => {
    const user = userEvent.setup();
    wrap(createElement(TodayPage));
    await user.click(screen.getByLabelText("Mark Morning walk complete"));
    expect(occurrenceMutate).toHaveBeenCalledWith(
      { entryId: "sched-1", occurrenceDate: "2026-08-20", isCompleted: true },
      expect.any(Object),
    );
  });

  it("opens the task detail drawer", async () => {
    const user = userEvent.setup();
    wrap(createElement(TodayPage));
    await user.click(screen.getByRole("button", { name: /Write brief/ }));
    expect(screen.getByText("Task drawer task-open")).toBeInTheDocument();
  });

  it("opens the note drawer", async () => {
    const user = userEvent.setup();
    wrap(createElement(TodayPage));
    await user.click(screen.getByRole("button", { name: /Grocery list/ }));
    expect(await screen.findByText("Note drawer Grocery list")).toBeInTheDocument();
    expect(loadNote).toHaveBeenCalledWith("note-1");
  });

  it("opens the schedule editor", async () => {
    const user = userEvent.setup();
    wrap(createElement(TodayPage));
    await user.click(screen.getByRole("button", { name: /Morning walk/ }));
    expect(screen.getByText("Schedule editor Morning walk")).toBeInTheDocument();
  });

  it("shows boundary dates as a single day when start and due match", () => {
    wrap(createElement(TodayPage));
    const task = screen.getByRole("button", { name: /Write brief/ });
    expect(within(task).getByText("Thu, Aug 20")).toBeInTheDocument();
    const ranged = screen.getByRole("button", { name: /Ship notes/ });
    expect(within(ranged).getByText("Tue, Aug 18 – Sat, Aug 22")).toBeInTheDocument();
  });

  it("retries after an error", async () => {
    const user = userEvent.setup();
    todayQuery.data = null;
    todayQuery.isError = true;
    wrap(createElement(TodayPage));
    expect(screen.getByText("Could not load today.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(todayQuery.refetch).toHaveBeenCalled();
  });

  it("uses theme tokens and a mobile-first layout", () => {
    const { container } = wrap(createElement(TodayPage));
    expect(container.innerHTML).toContain("bg-[var(--app-bg)]");
    expect(screen.getByLabelText("Today dashboard").className).toContain("grid-cols-1");
    expect(screen.getByLabelText("Pinned notes").innerHTML).not.toContain("sm:grid-cols-2");
    expect(screen.getByLabelText("Today's schedule").innerHTML).toContain("dark:");
  });
});
