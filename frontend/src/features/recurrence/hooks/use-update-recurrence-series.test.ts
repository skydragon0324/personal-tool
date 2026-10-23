import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";

import { boardKeys } from "@/features/board/api/board-queries";
import { dashboardKeys } from "@/features/dashboard/hooks/use-dashboard";
import { todayKeys } from "@/features/today/api/today-queries";

import { recurrenceKeys } from "../api/recurrence-queries";
import { useUpdateRecurrenceSeries } from "./use-update-recurrence-series";

const updateRecurrenceSeries = jest.fn();
const notifySuccess = jest.fn();
const notifyApiError = jest.fn();

jest.mock("@/lib/api-client", () => {
  const actual = jest.requireActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      updateRecurrenceSeries: (...args: unknown[]) => updateRecurrenceSeries(...args),
    },
  };
});

jest.mock("@/lib/notify", () => ({
  notifySuccess: (...args: unknown[]) => notifySuccess(...args),
  notifyApiError: (...args: unknown[]) => notifyApiError(...args),
}));

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client }, children);
  };
}

describe("useUpdateRecurrenceSeries", () => {
  beforeEach(() => {
    updateRecurrenceSeries.mockReset();
    notifySuccess.mockReset();
    notifyApiError.mockReset();
  });

  it("sends the payload and invalidates related queries", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = jest.spyOn(client, "invalidateQueries");
    updateRecurrenceSeries.mockResolvedValue({ id: "series-1", title: "Renamed", version: 5 });
    const { result } = renderHook(() => useUpdateRecurrenceSeries(), { wrapper: wrapper(client) });

    await act(async () => {
      await result.current.mutateAsync({
        seriesId: "series-1",
        boardId: "board-work",
        payload: { expected_version: 4, title: "Renamed" },
      });
    });

    expect(updateRecurrenceSeries).toHaveBeenCalledWith("series-1", {
      expected_version: 4,
      title: "Renamed",
    });
    expect(notifySuccess).toHaveBeenCalledWith("Recurring task updated");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: recurrenceKeys.all });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: recurrenceKeys.detail("series-1") });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: todayKeys.all });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: dashboardKeys.all });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: boardKeys.views("board-work") });
  });
});
