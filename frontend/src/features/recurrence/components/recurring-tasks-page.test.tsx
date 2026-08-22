import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";

import type { RecurrenceSeriesListItem, RecurrenceSeriesListResponse } from "../types";
import { RecurringTasksPage } from "./recurring-tasks-page";

const listRecurrenceSeries = vi.fn();
const stopRecurrence = vi.fn();
const resumeRecurrence = vi.fn();
const getRecurrenceSeries = vi.fn();
const updateRecurrenceSeries = vi.fn();
const listCategories = vi.fn();
const listColumns = vi.fn();
const notifyApiError = vi.fn();
const notifySuccess = vi.fn();

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement("a", { href }, children),
}));

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      listRecurrenceSeries: (...args: unknown[]) => listRecurrenceSeries(...args),
      stopRecurrence: (...args: unknown[]) => stopRecurrence(...args),
      resumeRecurrence: (...args: unknown[]) => resumeRecurrence(...args),
      getRecurrenceSeries: (...args: unknown[]) => getRecurrenceSeries(...args),
      updateRecurrenceSeries: (...args: unknown[]) => updateRecurrenceSeries(...args),
      listCategories: (...args: unknown[]) => listCategories(...args),
      listColumns: (...args: unknown[]) => listColumns(...args),
    },
  };
});

vi.mock("@/lib/notify", () => ({
  notifyApiError: (...args: unknown[]) => notifyApiError(...args),
  notifySuccess: (...args: unknown[]) => notifySuccess(...args),
}));

vi.mock("@/features/tasks/components/task-rich-text-editor", () => ({
  TaskRichTextEditor: () => createElement("div", { "data-testid": "rich-text" }, "editor"),
}));

vi.mock("@/features/board/hooks/use-boards", () => ({
  useBoards: () => ({
    data: [
      {
        id: "board-work",
        name: "Work",
        archived_at: null,
        position: 0,
      },
      {
        id: "board-home",
        name: "Personal",
        archived_at: null,
        position: 1,
      },
    ],
  }),
  activeBoards: (boards: Array<{ archived_at: string | null }> | undefined) =>
    (boards ?? []).filter((board) => !board.archived_at),
}));

function series(overrides: Partial<RecurrenceSeriesListItem> = {}): RecurrenceSeriesListItem {
  return {
    id: "series-1",
    board_id: "board-work",
    board_name: "Work",
    board_archived: false,
    default_column_id: "col-todo",
    default_column_name: "To Do",
    category_id: "cat-1",
    category_name: "Focus",
    title: "Weekly standup",
    priority: "high",
    timezone: "UTC",
    freq: "weekly",
    interval: 1,
    weekdays: [4],
    month_day: null,
    start_date: "2026-08-21",
    end_date: null,
    occurrence_limit: null,
    status: "active",
    generated_through: "2026-10-22",
    next_occurrence_date: "2026-08-21",
    open_occurrence_count: 3,
    completed_occurrence_count: 1,
    detached_occurrence_count: 2,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-20T00:00:00Z",
    ...overrides,
  };
}

function page(
  items: RecurrenceSeriesListItem[],
  params: { offset?: number; limit?: number; total?: number } = {},
): RecurrenceSeriesListResponse {
  const offset = params.offset ?? 0;
  const limit = params.limit ?? 25;
  const total = params.total ?? items.length;
  return { items, total, offset, limit };
}

function wrap() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(MantineProvider, { env: "test" }, createElement(RecurringTasksPage)),
    ),
  );
}

describe("Recurring tasks page", () => {
  beforeEach(() => {
    listRecurrenceSeries.mockReset();
    stopRecurrence.mockReset();
    resumeRecurrence.mockReset();
    getRecurrenceSeries.mockReset();
    updateRecurrenceSeries.mockReset();
    listCategories.mockReset();
    listColumns.mockReset();
    notifyApiError.mockReset();
    notifySuccess.mockReset();
    stopRecurrence.mockResolvedValue({ id: "series-1", status: "stopped" });
    resumeRecurrence.mockResolvedValue({ id: "series-1", status: "active" });
    getRecurrenceSeries.mockResolvedValue({
      id: "series-1",
      board_id: "board-work",
      default_column_id: "col-todo",
      category_id: "cat-1",
      title: "Weekly standup",
      priority: "high",
      duration_days: 0,
      timezone: "UTC",
      freq: "weekly",
      interval: 1,
      weekdays: [4],
      month_day: null,
      until_date: null,
      occurrence_limit: null,
      status: "active",
      dtstart: "2026-08-21",
      generated_through: null,
      next_occurrence_date: "2026-08-21",
      open_count: 1,
      completed_count: 0,
      detached_count: 0,
      version: 2,
      content: null,
      content_schema_version: 1,
      links: [],
    });
    listCategories.mockResolvedValue([]);
    listColumns.mockResolvedValue([]);
  });

  it("shows a loading state", () => {
    listRecurrenceSeries.mockReturnValue(new Promise(() => undefined));
    wrap();
    expect(screen.getByRole("status", { name: "Loading recurring tasks" })).toBeInTheDocument();
  });

  it("shows a retryable error state", async () => {
    listRecurrenceSeries.mockRejectedValue(new Error("network"));
    wrap();
    expect(await screen.findByText("Could not load recurring tasks.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    listRecurrenceSeries.mockResolvedValue(page([]));
    await userEvent.setup().click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => {
      expect(listRecurrenceSeries.mock.calls.length).toBeGreaterThan(2);
    });
  });

  it("shows an empty active state", async () => {
    listRecurrenceSeries.mockImplementation(async (params: { status?: string }) => {
      if (params.status === "stopped") return page([], { total: 2 });
      return page([]);
    });
    wrap();
    expect(await screen.findByText("No active recurring tasks")).toBeInTheDocument();
  });

  it("shows an empty stopped state", async () => {
    const user = userEvent.setup();
    listRecurrenceSeries.mockImplementation(async (params: { status?: string }) => {
      if (params.status === "stopped") return page([]);
      return page([series()], { total: 1 });
    });
    wrap();
    expect(await screen.findAllByText("Weekly standup")).not.toHaveLength(0);
    await user.click(screen.getByRole("tab", { name: "Stopped" }));
    expect(await screen.findByText("No stopped recurring tasks")).toBeInTheDocument();
  });

  it("renders active recurrence rows", async () => {
    listRecurrenceSeries.mockImplementation(async (params: { status?: string }) => {
      if (params.status === "stopped") return page([]);
      return page([series()]);
    });
    wrap();
    expect(await screen.findAllByText("Weekly standup")).not.toHaveLength(0);
    expect(screen.getAllByText("Weekly on Friday").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Open 3 · Completed 1 · Customized 2").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Focus").length).toBeGreaterThan(0);
    expect(screen.getAllByText("High").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
  });

  it("shows a placeholder when the default status is missing", async () => {
    listRecurrenceSeries.mockImplementation(async (params: { status?: string }) => {
      if (params.status === "stopped") return page([]);
      return page([series({ default_column_name: null })]);
    });
    wrap();
    expect(await screen.findAllByText("—")).not.toHaveLength(0);
  });

  it("renders stopped rows with an em dash for next occurrence", async () => {
    const user = userEvent.setup();
    const stopped = series({
      id: "series-stopped",
      title: "Old chore",
      status: "stopped",
      next_occurrence_date: null,
    });
    listRecurrenceSeries.mockImplementation(async (params: { status?: string }) => {
      if (params.status === "stopped") return page([stopped]);
      return page([series()]);
    });
    wrap();
    await screen.findAllByText("Weekly standup");
    await user.click(screen.getByRole("tab", { name: "Stopped" }));
    expect(await screen.findAllByText("Old chore")).not.toHaveLength(0);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("sends the selected board in the list query", async () => {
    const user = userEvent.setup();
    listRecurrenceSeries.mockImplementation(async (params: { status?: string }) => {
      if (params.status === "stopped") return page([]);
      return page([series()]);
    });
    wrap();
    await screen.findAllByText("Weekly standup");
    await user.selectOptions(screen.getByLabelText("Board"), "board-work");
    await waitFor(() => {
      expect(listRecurrenceSeries).toHaveBeenCalledWith(
        expect.objectContaining({ board_id: "board-work", status: "active", offset: 0 }),
      );
    });
  });

  it("resets pagination when the tab changes", async () => {
    const user = userEvent.setup();
    const items = Array.from({ length: 30 }, (_, index) =>
      series({ id: `series-${index}`, title: `Task ${index}` }),
    );
    listRecurrenceSeries.mockImplementation(
      async (params: { status?: string; offset?: number; limit?: number }) => {
        if (params.status === "stopped") return page([]);
        const offset = params.offset ?? 0;
        const limit = params.limit ?? 25;
        return page(items.slice(offset, offset + limit), { offset, limit, total: items.length });
      },
    );
    wrap();
    await screen.findAllByText("Task 0");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findAllByText("Task 25");
    await user.click(screen.getByRole("tab", { name: "Stopped" }));
    await waitFor(() => {
      const stoppedCalls = listRecurrenceSeries.mock.calls.filter(
        ([params]) => params.status === "stopped" && params.offset === 0 && params.limit === 25,
      );
      expect(stoppedCalls.length).toBeGreaterThan(0);
    });
  });

  it("resets pagination when page size changes", async () => {
    const user = userEvent.setup();
    const items = Array.from({ length: 30 }, (_, index) =>
      series({ id: `series-${index}`, title: `Task ${index}` }),
    );
    listRecurrenceSeries.mockImplementation(
      async (params: { status?: string; offset?: number; limit?: number }) => {
        if (params.status === "stopped") return page([]);
        const offset = params.offset ?? 0;
        const limit = params.limit ?? 25;
        return page(items.slice(offset, offset + limit), { offset, limit, total: items.length });
      },
    );
    wrap();
    await screen.findAllByText("Task 0");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findAllByText("Task 25");
    await user.selectOptions(screen.getByLabelText("Rows per page"), "50");
    await waitFor(() => {
      expect(listRecurrenceSeries).toHaveBeenCalledWith(
        expect.objectContaining({ status: "active", offset: 0, limit: 50 }),
      );
    });
  });

  it("uses correct offsets for Previous and Next", async () => {
    const user = userEvent.setup();
    const items = Array.from({ length: 30 }, (_, index) =>
      series({ id: `series-${index}`, title: `Task ${index}` }),
    );
    listRecurrenceSeries.mockImplementation(
      async (params: { status?: string; offset?: number; limit?: number }) => {
        if (params.status === "stopped") return page([]);
        const offset = params.offset ?? 0;
        const limit = params.limit ?? 25;
        return page(items.slice(offset, offset + limit), { offset, limit, total: items.length });
      },
    );
    wrap();
    await screen.findByText("Showing 1–25 of 30");
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Showing 26–30 of 30")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(await screen.findByText("Showing 1–25 of 30")).toBeInTheDocument();
  });

  it("shows an archived board badge", async () => {
    listRecurrenceSeries.mockImplementation(async (params: { status?: string }) => {
      if (params.status === "stopped") return page([]);
      return page([series({ board_archived: true, board_name: "Legacy" })]);
    });
    wrap();
    expect(await screen.findAllByText("Archived board")).not.toHaveLength(0);
    expect(screen.getAllByText("Legacy").length).toBeGreaterThan(0);
  });

  it("shows the no-future-occurrence state", async () => {
    listRecurrenceSeries.mockImplementation(async (params: { status?: string }) => {
      if (params.status === "stopped") return page([]);
      return page([series({ next_occurrence_date: null, title: "Ended soon" })]);
    });
    wrap();
    expect(await screen.findAllByText("Ended soon")).not.toHaveLength(0);
    expect(screen.getAllByText("No future occurrence").length).toBeGreaterThan(1);
  });

  it("shows responsive card content", async () => {
    listRecurrenceSeries.mockImplementation(async (params: { status?: string }) => {
      if (params.status === "stopped") return page([]);
      return page([series()]);
    });
    wrap();
    const cards = await screen.findAllByRole("listitem");
    const card = cards[0];
    expect(within(card).getByText("Weekly standup")).toBeInTheDocument();
    expect(within(card).getByText("Work")).toBeInTheDocument();
    expect(within(card).getByText("Weekly on Friday")).toBeInTheDocument();
    expect(within(card).getByText("Open 3 · Completed 1 · Customized 2")).toBeInTheDocument();
    expect(within(card).getByText("Active")).toBeInTheDocument();
  });

  it("links the board name to the board page", async () => {
    listRecurrenceSeries.mockImplementation(async (params: { status?: string }) => {
      if (params.status === "stopped") return page([]);
      return page([series()]);
    });
    wrap();
    const links = await screen.findAllByRole("link", { name: "Work" });
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toHaveAttribute("href", "/boards/board-work");
    }
  });

  it("shows Pause on active rows and Resume on stopped rows", async () => {
    const user = userEvent.setup();
    const stopped = series({
      id: "series-stopped",
      title: "Old chore",
      status: "stopped",
      next_occurrence_date: null,
    });
    listRecurrenceSeries.mockImplementation(async (params: { status?: string }) => {
      if (params.status === "stopped") return page([stopped]);
      return page([series()]);
    });
    wrap();
    await screen.findAllByText("Weekly standup");
    expect(screen.getAllByRole("button", { name: "Pause Weekly standup" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Edit Weekly standup" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Resume Weekly standup" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Edit$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Delete$/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Stopped" }));
    expect(await screen.findAllByText("Old chore")).not.toHaveLength(0);
    expect(screen.getAllByRole("button", { name: "Resume Old chore" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Edit Old chore" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Pause Old chore" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Edit$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Delete$/ })).not.toBeInTheDocument();
  });

  it("opens a confirmation modal for Pause and does not call the API on cancel", async () => {
    const user = userEvent.setup();
    listRecurrenceSeries.mockImplementation(async (params: { status?: string }) => {
      if (params.status === "stopped") return page([]);
      return page([series()]);
    });
    wrap();
    await user.click((await screen.findAllByRole("button", { name: "Pause Weekly standup" }))[0]);
    const dialog = await screen.findByRole("dialog", { name: "Pause recurring task?" });
    expect(dialog).toHaveTextContent(
      "Future occurrences will stop generating. Existing tasks and completed history will stay.",
    );
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Pause recurring task?" })).not.toBeInTheDocument();
    });
    expect(stopRecurrence).not.toHaveBeenCalled();
  });

  it("calls the stop endpoint after Pause is confirmed", async () => {
    const user = userEvent.setup();
    listRecurrenceSeries.mockImplementation(async (params: { status?: string }) => {
      if (params.status === "stopped") return page([]);
      return page([series()]);
    });
    wrap();
    await user.click((await screen.findAllByRole("button", { name: "Pause Weekly standup" }))[0]);
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Pause" }));
    await waitFor(() => {
      expect(stopRecurrence).toHaveBeenCalledWith("series-1");
    });
    expect(resumeRecurrence).not.toHaveBeenCalled();
  });

  it("calls the resume endpoint without a confirmation modal", async () => {
    const user = userEvent.setup();
    listRecurrenceSeries.mockImplementation(async (params: { status?: string }) => {
      if (params.status === "stopped") {
        return page([series({ id: "series-stopped", title: "Old chore", status: "stopped" })]);
      }
      return page([]);
    });
    wrap();
    await user.click(await screen.findByRole("tab", { name: "Stopped" }));
    await user.click((await screen.findAllByRole("button", { name: "Resume Old chore" }))[0]);
    await waitFor(() => {
      expect(resumeRecurrence).toHaveBeenCalledWith("series-stopped");
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(stopRecurrence).not.toHaveBeenCalled();
  });

  it("keeps the current tab and board filter after a successful pause", async () => {
    const user = userEvent.setup();
    let paused = false;
    listRecurrenceSeries.mockImplementation(
      async (params: { status?: string; board_id?: string }) => {
        if (params.status === "stopped") return page([]);
        if (paused) return page([]);
        return page([series()]);
      },
    );
    stopRecurrence.mockImplementation(async () => {
      paused = true;
      return { id: "series-1", status: "stopped" };
    });
    wrap();
    await screen.findAllByText("Weekly standup");
    await user.selectOptions(screen.getByLabelText("Board"), "board-work");
    await user.click(screen.getAllByRole("button", { name: "Pause Weekly standup" })[0]);
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Pause" }));
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Pause Weekly standup" })).not.toBeInTheDocument();
    });
    expect(screen.getByRole("tab", { name: "Active" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Board")).toHaveValue("board-work");
  });

  it("keeps the row unchanged when pause fails", async () => {
    const user = userEvent.setup();
    listRecurrenceSeries.mockImplementation(async (params: { status?: string }) => {
      if (params.status === "stopped") return page([]);
      return page([series()]);
    });
    stopRecurrence.mockRejectedValue(new ApiError("Could not pause", 500));
    wrap();
    await user.click((await screen.findAllByRole("button", { name: "Pause Weekly standup" }))[0]);
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Pause" }));
    await waitFor(() => {
      expect(notifyApiError).toHaveBeenCalled();
    });
    expect(screen.getAllByRole("button", { name: "Pause Weekly standup" }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Weekly standup").length).toBeGreaterThan(0);
  });

  it("shows a 409 resume error from the backend", async () => {
    const user = userEvent.setup();
    listRecurrenceSeries.mockImplementation(async (params: { status?: string }) => {
      if (params.status === "stopped") {
        return page([series({ id: "series-stopped", title: "Old chore", status: "stopped" })]);
      }
      return page([]);
    });
    resumeRecurrence.mockRejectedValue(
      new ApiError("This series has no remaining occurrences to resume.", 409),
    );
    wrap();
    await user.click(await screen.findByRole("tab", { name: "Stopped" }));
    await user.click((await screen.findAllByRole("button", { name: "Resume Old chore" }))[0]);
    await waitFor(() => {
      expect(notifyApiError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "This series has no remaining occurrences to resume.",
          status: 409,
        }),
        "Could not resume recurring task",
      );
    });
    expect(screen.getAllByRole("button", { name: "Resume Old chore" }).length).toBeGreaterThan(0);
  });

  it("disables Resume on an archived board and explains why", async () => {
    const user = userEvent.setup();
    listRecurrenceSeries.mockImplementation(async (params: { status?: string }) => {
      if (params.status === "stopped") {
        return page([
          series({
            id: "series-archived",
            title: "Old chore",
            status: "stopped",
            board_archived: true,
            board_name: "Legacy",
          }),
        ]);
      }
      return page([]);
    });
    wrap();
    await user.click(await screen.findByRole("tab", { name: "Stopped" }));
    const buttons = await screen.findAllByRole("button", { name: "Resume Old chore" });
    for (const button of buttons) {
      expect(button).toBeDisabled();
      expect(button).toHaveAccessibleDescription(
        "Restore the board before resuming this recurring task.",
      );
    }
    expect(
      screen.getAllByText("Restore the board before resuming this recurring task.").length,
    ).toBeGreaterThan(0);
    expect(resumeRecurrence).not.toHaveBeenCalled();
  });

  it("disables Edit on an archived board and explains why", async () => {
    listRecurrenceSeries.mockImplementation(async (params: { status?: string }) => {
      if (params.status === "stopped") return page([]);
      return page([series({ board_archived: true, board_name: "Legacy" })]);
    });
    wrap();
    const buttons = await screen.findAllByRole("button", { name: "Edit Weekly standup" });
    for (const button of buttons) {
      expect(button).toBeDisabled();
      expect(button).toHaveAccessibleDescription(
        "Restore the board before editing this recurring task.",
      );
    }
    expect(
      screen.getAllByText("Restore the board before editing this recurring task.").length,
    ).toBeGreaterThan(0);
  });

  it("opens the series editor from Edit without calling Pause or Resume", async () => {
    const user = userEvent.setup();
    listRecurrenceSeries.mockImplementation(async (params: { status?: string }) => {
      if (params.status === "stopped") return page([]);
      return page([series()]);
    });
    wrap();
    await user.click((await screen.findAllByRole("button", { name: "Edit Weekly standup" }))[0]);
    await waitFor(() => {
      expect(getRecurrenceSeries).toHaveBeenCalledWith("series-1");
    });
    expect(stopRecurrence).not.toHaveBeenCalled();
    expect(resumeRecurrence).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /^Delete$/ })).not.toBeInTheDocument();
  });

  it("does not allow a second Pause while the first request is pending", async () => {
    const user = userEvent.setup();
    let resolveStop: ((value: unknown) => void) | undefined;
    stopRecurrence.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveStop = resolve;
        }),
    );
    listRecurrenceSeries.mockImplementation(async (params: { status?: string }) => {
      if (params.status === "stopped") return page([]);
      return page([series()]);
    });
    wrap();
    await user.click((await screen.findAllByRole("button", { name: "Pause Weekly standup" }))[0]);
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Pause" }));
    await waitFor(() => {
      expect(screen.getAllByText("Pausing...").length).toBeGreaterThan(0);
    });
    const pendingButtons = screen.getAllByRole("button", { name: "Pause Weekly standup" });
    for (const button of pendingButtons) {
      expect(button).toBeDisabled();
    }
    await user.click(pendingButtons[0]);
    expect(stopRecurrence).toHaveBeenCalledTimes(1);
    resolveStop?.({ id: "series-1", status: "stopped" });
  });

  it("shows Pause on mobile cards", async () => {
    listRecurrenceSeries.mockImplementation(async (params: { status?: string }) => {
      if (params.status === "stopped") return page([]);
      return page([series()]);
    });
    wrap();
    const cards = await screen.findAllByRole("listitem");
    expect(within(cards[0]).getByRole("button", { name: "Pause Weekly standup" })).toBeInTheDocument();
    expect(within(cards[0]).getByRole("button", { name: "Edit Weekly standup" })).toBeInTheDocument();
  });

  it("shows Resume on mobile cards", async () => {
    const user = userEvent.setup();
    listRecurrenceSeries.mockImplementation(async (params: { status?: string }) => {
      if (params.status === "stopped") {
        return page([series({ id: "series-stopped", title: "Old chore", status: "stopped" })]);
      }
      return page([]);
    });
    wrap();
    await user.click(await screen.findByRole("tab", { name: "Stopped" }));
    const cards = await screen.findAllByRole("listitem");
    expect(within(cards[0]).getByRole("button", { name: "Resume Old chore" })).toBeInTheDocument();
    expect(within(cards[0]).getByRole("button", { name: "Edit Old chore" })).toBeInTheDocument();
  });

  it("shows a board-specific empty state", async () => {
    const user = userEvent.setup();
    listRecurrenceSeries.mockImplementation(
      async (params: { status?: string; board_id?: string }) => {
        if (params.board_id === "board-home") return page([]);
        if (params.status === "stopped") return page([]);
        return page([series()]);
      },
    );
    wrap();
    await screen.findAllByText("Weekly standup");
    await user.selectOptions(screen.getByLabelText("Board"), "board-home");
    expect(await screen.findByText("No recurring tasks on this board")).toBeInTheDocument();
  });
});
