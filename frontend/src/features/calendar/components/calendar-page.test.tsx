import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode } from "react";

import type { CalendarTask, CalendarTaskList } from "../types";
import { CALENDAR_VIEW_STORAGE_KEY } from "../hooks/use-calendar-view";
import { CALENDAR_COMPACT_QUERY, CalendarPage } from "./calendar-page";

const mockGetCalendarTasks = jest.fn();
const mockUpdateTask = jest.fn();
const mockPush = jest.fn();
const mockNotifyApiError = jest.fn();
const mockDnd: { onDragEnd?: (event: unknown) => void } = {};

jest.mock("@/lib/api-client", () => ({
  ApiError: class ApiError extends Error {},
  apiClient: {
    getCalendarTasks: (...args: unknown[]) => mockGetCalendarTasks(...args),
    updateTask: (...args: unknown[]) => mockUpdateTask(...args),
    listBoards: () =>
      Promise.resolve([
        { id: "b1", name: "Work", archived_at: null, position: 0, role: "owner" },
        { id: "b2", name: "Home", archived_at: null, position: 1, role: "owner" },
      ]),
  },
}));

jest.mock("@/lib/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/calendar",
}));

jest.mock("@/lib/dates", () => ({
  ...jest.requireActual<typeof import("@/lib/dates")>("@/lib/dates"),
  todayISO: () => "2026-08-20",
}));

jest.mock("@/lib/notify", () => ({
  notifyApiError: (...args: unknown[]) => mockNotifyApiError(...args),
  notifySuccess: jest.fn(),
}));

// Creating is QuickCreateTask's job (tested on its own); here we only check what it is asked for.
jest.mock("@/features/tasks/components/quick-create-task", () => ({
  QuickCreateTask: ({ opened, dueDate, boardId }: { opened: boolean; dueDate: string; boardId?: string | null }) =>
    opened ? createElement("div", { "data-testid": "quick-create" }, `create on ${dueDate} board ${boardId ?? "any"}`) : null,
}));

jest.mock("@dnd-kit/react", () => ({
  DragDropProvider: (props: { children: ReactNode; onDragEnd?: (event: unknown) => void }) => {
    mockDnd.onDragEnd = props.onDragEnd;
    return props.children;
  },
  useDraggable: () => ({ ref: () => undefined, isDragging: false }),
  useDroppable: () => ({ ref: () => undefined, isDropTarget: false }),
  PointerSensor: { configure: (options: unknown) => options },
}));

const task = (extra: Partial<CalendarTask> = {}): CalendarTask => ({
  id: "t1",
  title: "Write report",
  start_date: "2026-08-20",
  due_date: "2026-08-20",
  is_done: false,
  priority: "high",
  board_id: "b1",
  board_name: "Work",
  board_color: "blue",
  status_id: "s1",
  status_name: "Todo",
  ...extra,
});

function list(items: CalendarTask[], extra: Partial<CalendarTaskList> = {}): CalendarTaskList {
  return { start_date: "", end_date: "", items, truncated: false, limit: 500, ...extra };
}

function setScreen(compact: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: compact && query === CALENDAR_COMPACT_QUERY,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(MantineProvider, { env: "test" }, createElement(CalendarPage)),
    ),
  );
  return client;
}

const lastRange = () => {
  const [params] = mockGetCalendarTasks.mock.calls[mockGetCalendarTasks.mock.calls.length - 1];
  return params as { startDate: string; endDate: string; boardId: string | null };
};

const cell = (day: string) => document.querySelector(`[data-calendar-day="${day}"]`) as HTMLElement;

beforeEach(() => {
  mockGetCalendarTasks.mockReset();
  mockUpdateTask.mockReset();
  mockPush.mockReset();
  mockNotifyApiError.mockReset();
  window.localStorage.clear();
  setScreen(false);
});

describe("CalendarPage", () => {
  it("asks only for the visible month grid, including the surrounding days", async () => {
    mockGetCalendarTasks.mockResolvedValue(list([task()]));
    renderPage();
    expect(await screen.findByText("Write report")).toBeInTheDocument();
    expect(mockGetCalendarTasks).toHaveBeenCalledTimes(1);
    expect(lastRange()).toEqual({ startDate: "2026-07-27", endDate: "2026-09-06", boardId: null });
    expect(document.querySelector("[data-calendar-layout='month']")).not.toBeNull();
    expect(document.querySelectorAll("[data-calendar-day]")).toHaveLength(42);
    // A request for one range carries the abort signal, so a superseded range is canceled.
    expect(mockGetCalendarTasks.mock.calls[0][1]).toBeInstanceOf(AbortSignal);
  });

  it("switches between month, week and agenda, asking for each view's range", async () => {
    const user = userEvent.setup();
    mockGetCalendarTasks.mockResolvedValue(list([task()]));
    renderPage();
    await screen.findByText("Write report");

    await user.click(screen.getByRole("radio", { name: "Week" }));
    await waitFor(() => expect(lastRange()).toMatchObject({ startDate: "2026-08-17", endDate: "2026-08-23" }));
    expect(document.querySelector("[data-calendar-layout='week']")).not.toBeNull();
    expect(document.querySelectorAll("[data-calendar-day]")).toHaveLength(7);

    await user.click(screen.getByRole("button", { name: "Next week" }));
    await waitFor(() => expect(lastRange()).toMatchObject({ startDate: "2026-08-24", endDate: "2026-08-30" }));

    await user.click(screen.getByRole("radio", { name: "Agenda" }));
    await waitFor(() => expect(lastRange()).toMatchObject({ startDate: "2026-08-01", endDate: "2026-08-31" }));
    expect(document.querySelector("[data-calendar-layout='agenda']")).not.toBeNull();
    expect(window.localStorage.getItem(CALENDAR_VIEW_STORAGE_KEY)).toBe("agenda");
  });

  it("filters by board through the request", async () => {
    const user = userEvent.setup();
    mockGetCalendarTasks.mockResolvedValue(list([task()]));
    renderPage();
    await screen.findByText("Write report");
    await user.click(screen.getByRole("textbox", { name: "Show tasks from board" }));
    await user.click(await screen.findByRole("option", { name: "Home" }));
    await waitFor(() => expect(lastRange()).toMatchObject({ boardId: "b2" }));
  });

  it("shows an agenda instead of the grid on small screens", async () => {
    setScreen(true);
    mockGetCalendarTasks.mockResolvedValue(list([task(), task({ id: "t2", title: "Pay rent", due_date: "2026-08-25" })]));
    renderPage();
    expect(await screen.findByText("Pay rent")).toBeInTheDocument();
    expect(document.querySelector("[data-calendar-layout='agenda']")).not.toBeNull();
    expect(document.querySelector("[data-calendar-layout='month']")).toBeNull();
    // Only the month itself, requested once.
    expect(mockGetCalendarTasks).toHaveBeenCalledTimes(1);
    expect(lastRange()).toMatchObject({ startDate: "2026-08-01", endDate: "2026-08-31" });
    const day = screen.getByRole("region", { name: /August 25, 2026/ });
    expect(within(day).getByText("Work")).toBeInTheDocument();
  });

  it("keeps loading, error with retry, and empty states", async () => {
    const user = userEvent.setup();
    mockGetCalendarTasks.mockRejectedValueOnce(new Error("down"));
    window.localStorage.setItem(CALENDAR_VIEW_STORAGE_KEY, "agenda");
    renderPage();
    expect(screen.getByRole("status", { name: "Loading tasks" })).toBeInTheDocument();
    const retry = await screen.findByRole("button", { name: "Retry" });
    mockGetCalendarTasks.mockResolvedValue(list([]));
    await user.click(retry);
    expect(await screen.findByText("No tasks due in this period")).toBeInTheDocument();
  });

  it("shows a notice when the server cut the list short", async () => {
    mockGetCalendarTasks.mockResolvedValue(list([task()], { truncated: true, limit: 500 }));
    renderPage();
    expect(await screen.findByTestId("calendar-truncated")).toHaveTextContent("more than 500 tasks");
  });

  it("opens a task on its board", async () => {
    const user = userEvent.setup();
    mockGetCalendarTasks.mockResolvedValue(list([task()]));
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Write report · Work" }));
    expect(mockPush).toHaveBeenCalledWith("/boards/b1?task=t1");
  });

  it("creates a task on the date that was clicked", async () => {
    const user = userEvent.setup();
    mockGetCalendarTasks.mockResolvedValue(list([]));
    renderPage();
    await screen.findAllByRole("button", { name: /Add a task on/ });
    await user.click(screen.getByRole("button", { name: "Add a task on Tuesday, August 25, 2026" }));
    expect(screen.getByTestId("quick-create")).toHaveTextContent("create on 2026-08-25 board any");
  });

  it("moves a dropped task and keeps the move when the server agrees", async () => {
    mockGetCalendarTasks.mockResolvedValue(list([task({ start_date: "2026-08-18" })]));
    mockUpdateTask.mockImplementation(() => new Promise(() => undefined));
    renderPage();
    await screen.findByText("Write report");
    act(() => {
      mockDnd.onDragEnd?.({
        canceled: false,
        operation: { source: { data: { task: task({ start_date: "2026-08-18" }) } }, target: { data: { day: "2026-08-27" } } },
      });
    });
    await waitFor(() =>
      expect(mockUpdateTask).toHaveBeenCalledWith("t1", { start_date: "2026-08-25", due_date: "2026-08-27" }),
    );
    // Shown on the new day straight away.
    await waitFor(() => expect(within(cell("2026-08-27")).getByText("Write report")).toBeInTheDocument());
    expect(within(cell("2026-08-20")).queryByText("Write report")).toBeNull();
  });

  it("puts the task back and shows an error when the move fails", async () => {
    let reject: (error: Error) => void = () => undefined;
    mockGetCalendarTasks.mockResolvedValue(list([task()]));
    mockUpdateTask.mockImplementation(() => new Promise((_resolve, fail) => (reject = fail)));
    renderPage();
    await screen.findByText("Write report");
    act(() => {
      mockDnd.onDragEnd?.({ canceled: false, operation: { source: { data: { task: task() } }, target: { data: { day: "2026-08-27" } } } });
    });
    await waitFor(() => expect(within(cell("2026-08-27")).getByText("Write report")).toBeInTheDocument());
    // The refetch after the failure must not hide the restore: hold it until we have checked.
    mockGetCalendarTasks.mockImplementation(() => new Promise(() => undefined));
    await act(async () => reject(new Error("Server said no")));
    await waitFor(() => expect(within(cell("2026-08-20")).getByText("Write report")).toBeInTheDocument());
    expect(within(cell("2026-08-27")).queryByText("Write report")).toBeNull();
    expect(mockNotifyApiError).toHaveBeenCalledWith(expect.any(Error), expect.stringContaining("Could not move the task"));
  });

  it("reschedules without dragging through the change-date button", async () => {
    const user = userEvent.setup();
    mockGetCalendarTasks.mockResolvedValue(list([task()]));
    mockUpdateTask.mockResolvedValue({ id: "t1" });
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Change the due date of Write report" }));
    const dialog = await screen.findByRole("dialog", { name: "Change date" });
    await user.click(within(dialog).getByRole("button", { name: /22 August 2026|August 22, 2026/ }));
    await user.click(within(dialog).getByRole("button", { name: /Move to Aug 22, 2026/ }));
    await waitFor(() =>
      expect(mockUpdateTask).toHaveBeenCalledWith("t1", { start_date: "2026-08-22", due_date: "2026-08-22" }),
    );
  });
});
