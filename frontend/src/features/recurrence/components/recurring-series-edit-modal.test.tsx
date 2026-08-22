import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";

import type { RecurrenceSeriesRead } from "../types";
import { RecurringSeriesEditModal } from "./recurring-series-edit-modal";

const getRecurrenceSeries = vi.fn();
const updateRecurrenceSeries = vi.fn();
const listCategories = vi.fn();
const listColumns = vi.fn();
const createCategory = vi.fn();
const notifySuccess = vi.fn();
const notifyApiError = vi.fn();

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      getRecurrenceSeries: (...args: unknown[]) => getRecurrenceSeries(...args),
      updateRecurrenceSeries: (...args: unknown[]) => updateRecurrenceSeries(...args),
      listCategories: (...args: unknown[]) => listCategories(...args),
      listColumns: (...args: unknown[]) => listColumns(...args),
      createCategory: (...args: unknown[]) => createCategory(...args),
    },
  };
});

vi.mock("@/lib/notify", () => ({
  notifySuccess: (...args: unknown[]) => notifySuccess(...args),
  notifyApiError: (...args: unknown[]) => notifyApiError(...args),
}));

vi.mock("@/features/tasks/components/task-rich-text-editor", () => ({
  TaskRichTextEditor: () => createElement("div", { "data-testid": "rich-text" }, "editor"),
}));

const DETAIL: RecurrenceSeriesRead = {
  id: "series-1",
  board_id: "board-work",
  default_column_id: "col-todo",
  category_id: "cat-1",
  title: "Weekly report",
  priority: "medium",
  duration_days: 2,
  timezone: "UTC",
  freq: "weekly",
  interval: 1,
  weekdays: [4],
  month_day: null,
  until_date: "2026-12-31",
  occurrence_limit: null,
  status: "active",
  dtstart: "2026-08-21",
  generated_through: "2026-10-22",
  next_occurrence_date: "2026-08-21",
  open_count: 3,
  completed_count: 1,
  detached_count: 0,
  version: 4,
  content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "body" }] }] },
  content_schema_version: 1,
  links: [{ id: "link-1", label: "Docs", url: "https://example.com/docs", position: 0 }],
};

function wrap(seriesId: string | null = "series-1") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onClose = vi.fn();
  render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        MantineProvider,
        { env: "test" },
        createElement(RecurringSeriesEditModal, {
          seriesId,
          boardId: "board-work",
          onClose,
        }),
      ),
    ),
  );
  return { onClose, client };
}

describe("RecurringSeriesEditModal", () => {
  beforeEach(() => {
    getRecurrenceSeries.mockReset();
    updateRecurrenceSeries.mockReset();
    listCategories.mockReset();
    listColumns.mockReset();
    createCategory.mockReset();
    notifySuccess.mockReset();
    notifyApiError.mockReset();
    getRecurrenceSeries.mockResolvedValue(DETAIL);
    listCategories.mockResolvedValue([{ id: "cat-1", name: "Focus", color: "blue", board_id: "board-work", position: 0, created_at: "" }]);
    listColumns.mockResolvedValue([
      { id: "col-todo", name: "To Do", is_done: false, archived_at: null, position: 0, board_id: "board-work", color: "slate", icon_name: null, created_at: "", task_count: 0 },
      { id: "col-done", name: "Done", is_done: true, archived_at: null, position: 2, board_id: "board-work", color: "teal", icon_name: null, created_at: "", task_count: 0 },
      { id: "col-old", name: "Old", is_done: false, archived_at: "2026-01-01T00:00:00Z", position: 3, board_id: "board-work", color: "gray", icon_name: null, created_at: "", task_count: 0 },
    ]);
  });

  it("loads detail and initializes the form", async () => {
    wrap();
    expect(await screen.findByRole("status", { name: "Loading recurring task" })).toBeInTheDocument();
    expect(getRecurrenceSeries).toHaveBeenCalledWith("series-1");
    expect(await screen.findByRole("textbox", { name: "Title" })).toHaveValue("Weekly report");
    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "Category" })).toHaveValue("Focus");
    });
    expect(screen.getByRole("dialog", { name: "Edit recurring task" })).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Pause or resume this series from the recurring tasks list.")).toBeInTheDocument();
    expect(screen.queryByText("Does not repeat")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Docs")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://example.com/docs")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Delete$/ })).not.toBeInTheDocument();
  });

  it("shows Retry when detail fails", async () => {
    getRecurrenceSeries.mockRejectedValue(new Error("network"));
    wrap();
    expect(await screen.findByText("Could not load recurring task.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
    getRecurrenceSeries.mockResolvedValue(DETAIL);
    await userEvent.setup().click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("textbox", { name: "Title" })).toHaveValue("Weekly report");
  });

  it("does not call PATCH when nothing changed", async () => {
    wrap();
    await screen.findByRole("textbox", { name: "Title" });
    await userEvent.setup().click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => {
      expect(notifySuccess).toHaveBeenCalledWith("No changes to save.");
    });
    expect(updateRecurrenceSeries).not.toHaveBeenCalled();
  });

  it("sends expected_version and only the changed title", async () => {
    const user = userEvent.setup();
    wrap();
    const title = await screen.findByRole("textbox", { name: "Title" });
    await user.clear(title);
    await user.type(title, "Renamed");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => {
      expect(updateRecurrenceSeries).toHaveBeenCalledWith("series-1", {
        expected_version: 4,
        title: "Renamed",
      });
    });
  });

  it("keeps the modal open after a failed save", async () => {
    const user = userEvent.setup();
    updateRecurrenceSeries.mockRejectedValue(new ApiError("Could not update", 500));
    const { onClose } = wrap();
    const title = await screen.findByRole("textbox", { name: "Title" });
    await user.clear(title);
    await user.type(title, "Renamed");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => {
      expect(notifyApiError).toHaveBeenCalled();
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("Renamed")).toBeInTheDocument();
  });

  it("shows Reload latest on a stale version and reinitializes the form", async () => {
    const user = userEvent.setup();
    updateRecurrenceSeries.mockRejectedValueOnce(
      new ApiError("Recurrence series version is stale; refresh and try again", 409),
    );
    wrap();
    const title = await screen.findByRole("textbox", { name: "Title" });
    await user.clear(title);
    await user.type(title, "Stale edit");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("This recurring task changed elsewhere.")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Stale edit")).toBeInTheDocument();
    getRecurrenceSeries.mockResolvedValue({ ...DETAIL, title: "Server title", version: 8 });
    await user.click(screen.getByRole("button", { name: "Reload latest" }));
    expect(await screen.findByDisplayValue("Server title")).toBeInTheDocument();
    expect(screen.queryByText("This recurring task changed elsewhere.")).not.toBeInTheDocument();
  });

  it("excludes Done and archived columns from starting status choices", async () => {
    const user = userEvent.setup();
    wrap();
    await screen.findByRole("textbox", { name: "Title" });
    await user.click(screen.getByRole("textbox", { name: "Starting status" }));
    expect(screen.getByRole("option", { name: "To Do" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Automatic — first available status" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Done" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Old" })).not.toBeInTheDocument();
  });

  it("can create and select a category", async () => {
    const user = userEvent.setup();
    createCategory.mockResolvedValue({
      id: "cat-new",
      name: "Ops",
      color: "teal",
      board_id: "board-work",
      position: 1,
      created_at: "",
    });
    wrap();
    await screen.findByRole("textbox", { name: "Title" });
    const category = screen.getByRole("textbox", { name: "Category" });
    await user.clear(category);
    await user.type(category, "Ops");
    await user.click(screen.getByText("Create “Ops”"));
    await waitFor(() => {
      expect(createCategory).toHaveBeenCalledWith("board-work", { name: "Ops", color: expect.any(String) });
    });
  });

  it("prevents a second save while the first request is pending", async () => {
    const user = userEvent.setup();
    let resolveUpdate: ((value: unknown) => void) | undefined;
    updateRecurrenceSeries.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve;
        }),
    );
    wrap();
    const title = await screen.findByRole("textbox", { name: "Title" });
    await user.clear(title);
    await user.type(title, "Renamed");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("button", { name: "Saving..." })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Saving..." }));
    expect(updateRecurrenceSeries).toHaveBeenCalledTimes(1);
    resolveUpdate?.({ ...DETAIL, title: "Renamed", version: 5 });
  });

  it("warns when the saved starting status is archived and still allows other edits", async () => {
    const user = userEvent.setup();
    getRecurrenceSeries.mockResolvedValue({ ...DETAIL, default_column_id: "col-old" });
    wrap();
    expect(await screen.findByText(/The saved starting status is archived or unavailable/)).toBeInTheDocument();
    const title = screen.getByRole("textbox", { name: "Title" });
    await user.clear(title);
    await user.type(title, "Keep column");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => {
      expect(updateRecurrenceSeries).toHaveBeenCalledWith("series-1", {
        expected_version: 4,
        title: "Keep column",
      });
    });
  });

  it("shows validation errors without calling the API", async () => {
    const user = userEvent.setup();
    wrap();
    const title = await screen.findByRole("textbox", { name: "Title" });
    await user.clear(title);
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Enter a title.")).toBeInTheDocument();
    expect(updateRecurrenceSeries).not.toHaveBeenCalled();
  });

  it("does not fetch detail when closed", () => {
    wrap(null);
    expect(getRecurrenceSeries).not.toHaveBeenCalled();
  });
});
