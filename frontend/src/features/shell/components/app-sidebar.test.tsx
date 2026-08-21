import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { AppSidebar } from "./app-sidebar";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
    createElement("a", { href, ...props }, children),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/boards/board-1",
}));

vi.mock("@/features/auth/components/auth-provider", () => ({
  useAuth: () => ({
    user: { display_name: "Ada", email: "ada@example.com" },
    logout: vi.fn(),
  }),
}));

vi.mock("@/features/board/hooks/use-boards", () => ({
  useBoards: () => ({
    data: [{ id: "board-1", name: "Personal", color: "teal", icon_name: "home", archived_at: null }],
  }),
  activeBoards: (boards: Array<{ id: string; name: string }> | undefined) => boards ?? [],
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
