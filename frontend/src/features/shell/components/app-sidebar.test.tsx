import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";

import { AppSidebar } from "./app-sidebar";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
    createElement("a", { href, ...props }, children),
}));

jest.mock("@/lib/navigation", () => ({
  usePathname: () => "/boards/board-1",
}));

jest.mock("@/features/auth/components/auth-provider", () => ({
  useAuth: () => ({
    user: { display_name: "Ada", email: "ada@example.com" },
    logout: jest.fn(),
  }),
}));

jest.mock("@/features/board/hooks/use-boards", () => ({
  useBoards: () => ({
    data: [{ id: "board-1", name: "Personal", color: "teal", icon_name: "home", archived_at: null }],
  }),
  activeBoards: (boards: Array<{ id: string; name: string }> | undefined) => boards ?? [],
}));

jest.mock("@/features/notifications/components/notification-bell", () => ({
  NotificationBell: () => createElement("button", { type: "button", "aria-label": "Notifications" }),
}));

describe("sidebar board hierarchy", () => {
  it("nests board children under Boards and keeps New/Manage off the sidebar", async () => {
    render(createElement(MantineProvider, { env: "test" }, createElement(AppSidebar)));
    expect(screen.queryByRole("link", { name: /Inbox/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New board" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Manage boards" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Boards/ })).toHaveAttribute("href", "/boards");
    const boards = await screen.findByLabelText("Your boards");
    expect(boards.className).toContain("ml-3");
    expect(boards.className).toContain("border-l");
    expect(screen.getByRole("link", { name: /Personal/ }).className).toContain("text-xs");
  });
});
