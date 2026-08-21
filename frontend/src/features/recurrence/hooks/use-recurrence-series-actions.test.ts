import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { boardKeys } from "@/features/board/api/board-queries";
import { dashboardKeys } from "@/features/dashboard/hooks/use-dashboard";
import { todayKeys } from "@/features/today/api/today-queries";
import { ApiError } from "@/lib/api-client";

import { recurrenceKeys } from "../api/recurrence-queries";
import { useRecurrenceSeriesActions } from "./use-recurrence-series-actions";

const stopRecurrence = vi.fn();
const resumeRecurrence = vi.fn();
const notifyApiError = vi.fn();
const notifySuccess = vi.fn();

vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      stopRecurrence: (...args: unknown[]) => stopRecurrence(...args),
      resumeRecurrence: (...args: unknown[]) => resumeRecurrence(...args),
    },
  };
});

vi.mock("@/lib/notify", () => ({
  notifyApiError: (...args: unknown[]) => notifyApiError(...args),
  notifySuccess: (...args: unknown[]) => notifySuccess(...args),
}));

const seriesRead = {
  id: "series-1",
  board_id: "board-work",
  status: "stopped",
  title: "Weekly standup",
};

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children);
  };
}

describe("recurrence series actions", () => {
  beforeEach(() => {
    stopRecurrence.mockReset();
    resumeRecurrence.mockReset();
    notifyApiError.mockReset();
    notifySuccess.mockReset();
  });

  it("invalidates recurrence, today, dashboard, and board views after pause", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    stopRecurrence.mockResolvedValue(seriesRead);
    const { result } = renderHook(() => useRecurrenceSeriesActions(), {
      wrapper: wrapper(client),
    });

    await act(async () => {
      await result.current.pause.mutateAsync({
        seriesId: "series-1",
        boardId: "board-work",
      });
    });

    expect(stopRecurrence).toHaveBeenCalledWith("series-1");
    expect(notifySuccess).toHaveBeenCalledWith("Recurring task paused");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: recurrenceKeys.all });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: todayKeys.all });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: dashboardKeys.all });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: boardKeys.views("board-work") });
  });

  it("invalidates the same queries after resume", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    resumeRecurrence.mockResolvedValue({ ...seriesRead, status: "active" });
    const { result } = renderHook(() => useRecurrenceSeriesActions(), {
      wrapper: wrapper(client),
    });

    await act(async () => {
      await result.current.resume.mutateAsync({
        seriesId: "series-1",
        boardId: "board-work",
      });
    });

    expect(resumeRecurrence).toHaveBeenCalledWith("series-1");
    expect(notifySuccess).toHaveBeenCalledWith("Recurring task resumed");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: recurrenceKeys.all });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: todayKeys.all });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: dashboardKeys.all });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: boardKeys.views("board-work") });
  });

  it("does not remove cached list rows on failure", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const listKey = recurrenceKeys.list({ status: "active", offset: 0, limit: 25 });
    client.setQueryData(listKey, {
      items: [{ id: "series-1", title: "Weekly standup", status: "active" }],
      total: 1,
      offset: 0,
      limit: 25,
    });
    stopRecurrence.mockRejectedValue(new ApiError("Could not pause", 500));
    const { result } = renderHook(() => useRecurrenceSeriesActions(), {
      wrapper: wrapper(client),
    });

    await act(async () => {
      await result.current.pause
        .mutateAsync({ seriesId: "series-1", boardId: "board-work" })
        .catch(() => undefined);
    });

    const cached = client.getQueryData<{ items: Array<{ id: string }> }>(listKey);
    expect(cached?.items).toEqual([
      { id: "series-1", title: "Weekly standup", status: "active" },
    ]);
    expect(notifyApiError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Could not pause", status: 500 }),
      "Could not pause recurring task",
    );
  });

  it("surfaces a 409 detail through notifyApiError", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    resumeRecurrence.mockRejectedValue(
      new ApiError("This series has no remaining occurrences to resume.", 409),
    );
    const { result } = renderHook(() => useRecurrenceSeriesActions(), {
      wrapper: wrapper(client),
    });

    await act(async () => {
      await result.current.resume
        .mutateAsync({ seriesId: "series-1", boardId: "board-work" })
        .catch(() => undefined);
    });

    await waitFor(() => {
      expect(notifyApiError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "This series has no remaining occurrences to resume.",
          status: 409,
        }),
        "Could not resume recurring task",
      );
    });
  });
});
