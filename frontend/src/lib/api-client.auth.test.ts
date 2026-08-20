import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiClient, setCsrfToken, setUnauthorizedHandler } from "@/lib/api-client";

describe("api client auth helpers", () => {
  afterEach(() => {
    setUnauthorizedHandler(null);
    setCsrfToken(null);
    vi.unstubAllGlobals();
  });

  it("includes credentials and CSRF on mutations and handles 401", async () => {
    const unauthorized = vi.fn();
    setUnauthorizedHandler(unauthorized);
    setCsrfToken("csrf-token");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({ detail: "Not authenticated" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiClient.listBoards()).rejects.toBeInstanceOf(ApiError);
    expect(unauthorized).toHaveBeenCalled();

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ id: "board-1" }),
    });
    await apiClient.createBoard({ name: "Work", timezone: "UTC", color: "teal" });
    const init = fetchMock.mock.calls.at(-1)?.[1] as RequestInit;
    expect(init.credentials).toBe("include");
    const headers = new Headers(init.headers);
    expect(headers.get("X-CSRF-Token")).toBe("csrf-token");
  });

  it("fetches a CSRF token before mutations when none is cached", async () => {
    setCsrfToken(null);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ csrf_token: "fresh-csrf" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: "board-1" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    await apiClient.createBoard({ name: "Work", timezone: "UTC", color: "teal" });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/v1/auth/csrf");
    const init = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(new Headers(init.headers).get("X-CSRF-Token")).toBe("fresh-csrf");
  });

  it("does not fetch CSRF before login", async () => {
    setCsrfToken(null);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        user: { id: "u1", email: "a@b.com", display_name: "A", timezone: "UTC", created_at: "" },
        csrf_token: "from-login",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await apiClient.login({ email: "a@b.com", password: "password12" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/v1/auth/login");
  });
});
