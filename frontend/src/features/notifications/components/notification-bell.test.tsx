import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { NotificationFeed } from "../types";
import { NotificationBell } from "./notification-bell";

const getNotifications = vi.fn();
const markAllNotificationsRead = vi.fn();
const dismissNotification = vi.fn();
const markNotificationRead = vi.fn();
const push = vi.fn();

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return {
    ...actual,
    apiClient: {
      ...actual.apiClient,
      getNotifications: () => getNotifications(),
      markAllNotificationsRead: () => markAllNotificationsRead(),
      dismissNotification: (id: string) => dismissNotification(id),
      markNotificationRead: (id: string) => markNotificationRead(id),
    },
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/today",
}));

const FEED: NotificationFeed = {
  server_time: "2026-09-23T09:05:00Z",
  unread_count: 1,
  items: [
    {
      id: "n-1",
      kind: "schedule_start",
      title: "Standup",
      body: "Starts in 10 min · 09:15–09:30",
      board_id: null,
      task_id: null,
      schedule_entry_id: "entry-1",
      fire_at: "2026-09-23T09:05:00Z",
      read_at: null,
      created_at: "2026-09-23T09:05:00Z",
    },
    {
      id: "n-2",
      kind: "task_reminder",
      title: "Pay invoice",
      body: "Due today",
      board_id: "board-1",
      task_id: "task-9",
      schedule_entry_id: null,
      fire_at: "2026-09-23T08:00:00Z",
      read_at: "2026-09-23T08:01:00Z",
      created_at: "2026-09-23T08:00:00Z",
    },
  ],
};

function renderBell() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(MantineProvider, { env: "test" }, createElement(NotificationBell)),
    ),
  );
}

describe("NotificationBell", () => {
  beforeEach(() => {
    getNotifications.mockReset().mockResolvedValue(FEED);
    markAllNotificationsRead.mockReset().mockResolvedValue(undefined);
    dismissNotification.mockReset().mockResolvedValue(undefined);
    markNotificationRead.mockReset().mockResolvedValue({});
    push.mockReset();
  });

  it("shows the unread count and lists notifications", async () => {
    renderBell();
    const bell = await screen.findByRole("button", { name: "Notifications (1 unread)" });
    await userEvent.click(bell);
    expect(await screen.findByText("Standup")).toBeInTheDocument();
    expect(screen.getByText("Pay invoice")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Mark all read" }));
    await waitFor(() => expect(markAllNotificationsRead).toHaveBeenCalled());
  });

  it("opens a reminder's task and dismisses items", async () => {
    renderBell();
    await userEvent.click(await screen.findByRole("button", { name: /Notifications/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Dismiss Standup" }));
    await waitFor(() => expect(dismissNotification).toHaveBeenCalledWith("n-1"));

    await userEvent.click(screen.getByText("Pay invoice"));
    expect(push).toHaveBeenCalledWith("/boards/board-1?task=task-9");
    expect(markNotificationRead).not.toHaveBeenCalled();
  });
});
