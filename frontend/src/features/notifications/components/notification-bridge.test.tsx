import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { NotificationFeed } from "../types";
import { LAST_ANNOUNCED_KEY, PERMISSION_PROMPTED_KEY } from "../utils/notification-utils";
import { NotificationBridge } from "./notification-bridge";

const getNotifications = vi.fn();
const markNotificationRead = vi.fn();
const push = vi.fn();
const show = vi.fn();

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      getNotifications: () => getNotifications(),
      markNotificationRead: (id: string) => markNotificationRead(id),
    },
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/today",
}));

vi.mock("@mantine/notifications", () => ({
  notifications: { show: (...args: unknown[]) => show(...args), hide: vi.fn() },
}));

const created: Array<{ title: string; options: NotificationOptions; instance: { onclick: (() => void) | null } }> = [];

class FakeNotification {
  static permission: NotificationPermission = "granted";
  static requestPermission = vi.fn(async () => FakeNotification.permission);
  onclick: (() => void) | null = null;
  constructor(title: string, options: NotificationOptions) {
    created.push({ title, options, instance: this });
  }
  close() {}
}

function feed(): NotificationFeed {
  return {
    server_time: "2026-09-23T09:00:30Z",
    unread_count: 2,
    items: [
      {
        id: "n-new",
        kind: "task_reminder",
        title: "Call the bank",
        body: "Due today",
        board_id: "board-1",
        task_id: "task-1",
        schedule_entry_id: null,
        fire_at: "2026-09-23T09:00:00Z",
        read_at: null,
        created_at: "2026-09-23T09:00:00Z",
      },
      {
        id: "n-old",
        kind: "daily_digest",
        title: "Your day at a glance",
        body: "2 tasks due today",
        board_id: null,
        task_id: null,
        schedule_entry_id: null,
        fire_at: "2026-09-23T08:00:00Z",
        read_at: null,
        created_at: "2026-09-23T08:00:00Z",
      },
    ],
  };
}

function renderBridge() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(MantineProvider, null, createElement(NotificationBridge)),
    ),
  );
}

describe("NotificationBridge", () => {
  beforeEach(() => {
    created.length = 0;
    push.mockReset();
    show.mockReset();
    markNotificationRead.mockReset().mockResolvedValue({});
    getNotifications.mockReset().mockResolvedValue(feed());
    window.localStorage.clear();
    FakeNotification.permission = "granted";
    vi.stubGlobal("Notification", FakeNotification);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows an OS notification for new items only and opens the task on click", async () => {
    renderBridge();
    await waitFor(() => expect(created).toHaveLength(1));
    expect(created[0].title).toBe("Call the bank");
    expect(created[0].options).toMatchObject({ body: "Due today", tag: "n-new" });
    expect(show).toHaveBeenCalledWith(expect.objectContaining({ title: "Call the bank" }));
    expect(window.localStorage.getItem(LAST_ANNOUNCED_KEY)).toBe("2026-09-23T09:00:00.000Z");

    created[0].instance.onclick?.();
    expect(push).toHaveBeenCalledWith("/boards/board-1?task=task-1");
    await waitFor(() => expect(markNotificationRead).toHaveBeenCalledWith("n-new"));
  });

  it("does not show OS notifications when the user turned them off", async () => {
    window.localStorage.setItem("life-management:notifications:desktop", "off");
    renderBridge();
    await waitFor(() => expect(show).toHaveBeenCalledWith(expect.objectContaining({ title: "Call the bank" })));
    expect(created).toHaveLength(0);
  });

  it("asks once for desktop permission when the browser has not decided yet", async () => {
    FakeNotification.permission = "default";
    renderBridge();
    await waitFor(() =>
      expect(show).toHaveBeenCalledWith(expect.objectContaining({ title: "Turn on desktop notifications?" })),
    );
    expect(created).toHaveLength(0);

    show.mockReset();
    window.localStorage.setItem(PERMISSION_PROMPTED_KEY, "1");
    renderBridge();
    await waitFor(() => expect(getNotifications).toHaveBeenCalled());
    expect(show).not.toHaveBeenCalledWith(expect.objectContaining({ title: "Turn on desktop notifications?" }));
  });
});
