import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import { todayKeys } from "@/features/today/api/today-queries";
import type { TodayResponse } from "@/features/today/types";

import type { ScheduleWeek } from "../types";
import { scheduleKeys } from "./use-schedule";
import { useScheduleOccurrence } from "./use-schedule-occurrence";

const setScheduleOccurrence = vi.fn();

vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      setScheduleOccurrence: (...args: unknown[]) => setScheduleOccurrence(...args),
    },
  };
});

vi.mock("@/lib/notify", () => ({
  notifyApiError: vi.fn(),
}));

const weekKey = scheduleKeys.week("2026-08-17", "2026-08-20");
const todayKey = todayKeys.day("2026-08-20");

const week: ScheduleWeek = {
  week_start: "2026-08-17",
  today: "2026-08-20",
  entries: [
    {
      id: "entry-1",
      title: "Morning stretch",
      kind: "routine",
      weekdays: [0, 3],
      week_start: null,
      start_time: "08:00:00",
      end_time: "08:30:00",
      priority: null,
      color: "teal",
      notes: "",
      created_at: "2026-08-17T00:00:00Z",
      updated_at: "2026-08-17T00:00:00Z",
    },
  ],
  occurrences: [],
};

const today: TodayResponse = {
  date: "2026-08-20",
  task_progress: { total: 0, completed: 0, remaining: 0, percentage: 0 },
  schedule_progress: { total: 1, completed: 0, remaining: 1, percentage: 0 },
  active_tasks: [],
  overdue_tasks: [],
  schedules: [
    {
      id: "entry-1",
      title: "Morning stretch",
      kind: "routine",
      weekdays: [0, 3],
      week_start: null,
      start_time: "08:00:00",
      end_time: "08:30:00",
      priority: null,
      color: "teal",
      notes: "",
      is_completed: false,
      completed_at: null,
    },
  ],
  pinned_notes: [],
  pinned_notes_total: 0,
};

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children);
  };
}

describe("useScheduleOccurrence", () => {
  beforeEach(() => {
    setScheduleOccurrence.mockReset();
  });

  it("rolls back Schedule and Today caches when the mutation fails", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    client.setQueryData(weekKey, week);
    client.setQueryData(todayKey, today);
    setScheduleOccurrence.mockRejectedValue(new ApiError("Could not update schedule", 500));
    const { result } = renderHook(() => useScheduleOccurrence(), { wrapper: wrapper(client) });

    await act(async () => {
      await result.current.mutateAsync({
        entryId: "entry-1",
        occurrenceDate: "2026-08-20",
        isCompleted: true,
      }).catch(() => undefined);
    });

    await waitFor(() => {
      const cachedWeek = client.getQueryData<ScheduleWeek>(weekKey);
      const cachedToday = client.getQueryData<TodayResponse>(todayKey);
      expect(cachedWeek?.occurrences.some((item) => item.is_completed)).toBe(false);
      expect(cachedToday?.schedules[0]?.is_completed).toBe(false);
    });
  });

  it("invalidates Schedule and Today queries after a successful toggle", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    client.setQueryData(weekKey, week);
    client.setQueryData(todayKey, today);
    setScheduleOccurrence.mockResolvedValue({
      schedule_entry_id: "entry-1",
      occurrence_date: "2026-08-20",
      is_completed: true,
      completed_at: "2026-08-20T12:00:00Z",
    });
    const { result } = renderHook(() => useScheduleOccurrence(), { wrapper: wrapper(client) });

    await act(async () => {
      await result.current.mutateAsync({
        entryId: "entry-1",
        occurrenceDate: "2026-08-20",
        isCompleted: true,
      });
    });

    expect(setScheduleOccurrence).toHaveBeenCalledWith("entry-1", "2026-08-20", { is_completed: true });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: scheduleKeys.all });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: todayKeys.all });
    const cachedWeek = client.getQueryData<ScheduleWeek>(weekKey);
    expect(cachedWeek?.occurrences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          schedule_entry_id: "entry-1",
          occurrence_date: "2026-08-20",
          is_completed: true,
        }),
      ]),
    );
  });

  it("uses entry id and occurrence date as the pending key", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    let resolvePromise: (value: unknown) => void = () => undefined;
    setScheduleOccurrence.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePromise = resolve;
        }),
    );
    const { result } = renderHook(() => useScheduleOccurrence(), { wrapper: wrapper(client) });

    act(() => {
      result.current.mutate({
        entryId: "entry-1",
        occurrenceDate: "2026-08-17",
        isCompleted: true,
      });
    });

    await waitFor(() => {
      expect(result.current.pendingKey).toBe("entry-1:2026-08-17");
    });

    await act(async () => {
      resolvePromise({
        schedule_entry_id: "entry-1",
        occurrence_date: "2026-08-17",
        is_completed: true,
        completed_at: "2026-08-17T12:00:00Z",
      });
    });
  });
});
