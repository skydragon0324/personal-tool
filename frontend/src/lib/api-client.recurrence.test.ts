import { afterEach, describe, expect, it, vi } from "vitest";

import { apiClient, setCsrfToken, setUnauthorizedHandler } from "@/lib/api-client";

const seriesRead = {
  id: "series-1",
  board_id: "board-work",
  default_column_id: "col-todo",
  category_id: "cat-1",
  title: "Weekly standup",
  priority: "high",
  duration_days: 1,
  timezone: "UTC",
  freq: "weekly",
  interval: 1,
  weekdays: [4],
  month_day: null,
  until_date: null,
  occurrence_limit: null,
  status: "stopped",
  dtstart: "2026-08-21",
  generated_through: "2026-10-22",
  next_occurrence_date: null,
  open_count: 3,
  completed_count: 1,
  detached_count: 2,
  version: 2,
  content: null,
  content_schema_version: 1,
  links: [],
};

describe("api client recurrence actions", () => {
  afterEach(() => {
    setUnauthorizedHandler(null);
    setCsrfToken(null);
    vi.unstubAllGlobals();
  });

  it("posts stop and resume to the series endpoints and returns RecurrenceSeriesRead", async () => {
    setCsrfToken("csrf-token");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => seriesRead,
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiClient.stopRecurrence("series-1")).resolves.toMatchObject({
      id: "series-1",
      status: "stopped",
      title: "Weekly standup",
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "/api/v1/task-recurrence/series-1/stop",
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe("POST");

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ...seriesRead, status: "active" }),
    });
    await expect(apiClient.resumeRecurrence("series-1")).resolves.toMatchObject({
      id: "series-1",
      status: "active",
    });
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain(
      "/api/v1/task-recurrence/series-1/resume",
    );
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).method).toBe("POST");
  });

  it("patches a recurrence series with the update payload", async () => {
    setCsrfToken("csrf-token");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ...seriesRead, title: "Renamed", version: 3 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      apiClient.updateRecurrenceSeries("series-1", { expected_version: 2, title: "Renamed" }),
    ).resolves.toMatchObject({ title: "Renamed", version: 3 });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/v1/task-recurrence/series-1");
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe("PATCH");
    expect(JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body))).toEqual({
      expected_version: 2,
      title: "Renamed",
    });
  });
});
