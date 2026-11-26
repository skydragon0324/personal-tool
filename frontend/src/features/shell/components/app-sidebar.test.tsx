import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { createElement, forwardRef, type ReactNode } from "react";

import { AppSidebar } from "./app-sidebar";

jest.mock("next/link", () => ({
  __esModule: true,
  default: forwardRef<HTMLAnchorElement, { href: string; children: ReactNode }>(function MockLink({ href, children, ...props }, ref) {
    return createElement("a", { href, ref, ...props }, children);
  }),
}));

jest.mock("@/lib/navigation", () => ({
  usePathname: () => "/boards/board-1",
}));

// The search field is tested on its own (search-field.test.tsx).
jest.mock("@/features/search/components/search-field", () => ({
  SearchField: () => createElement("input", { "aria-label": "Search tasks, boards, notes and plans" }),
}));

jest.mock("@/features/auth/components/auth-provider", () => ({
  useAuth: () => ({
    user: { display_name: "Ada", login_id: "ada" },
    logout: jest.fn(),
  }),
}));

jest.mock("@/features/board/hooks/use-boards", () => ({
  useBoards: () => ({
    data: [{ id: "board-1", name: "Personal", color: "teal", icon_name: "home", archived_at: null }],
  }),
  activeBoards: (boards: Array<{ id: string; name: string }> | undefined) => boards ?? [],
}));

jest.mock("@/features/board/hooks/use-board-folders", () => ({
  useBoardFolders: () => ({ data: [{ id: "folder-1", name: "Work", position: 0 }] }),
  useBoardFolderMutations: () => ({
    create: { isPending: false },
    rename: { isPending: false },
    remove: { isPending: false },
    moveBoard: { mutate: jest.fn() },
  }),
  boardsInFolder: (boards: Array<{ folder_id?: string | null }>, _ids: Set<string>, id: string | null) =>
    boards.filter((board) => (board.folder_id ?? null) === id),
}));

jest.mock("../hooks/use-sidebar-counts", () => ({
  useSidebarCounts: () => ({ myTasks: 8, inbox: 2 }),
}));

jest.mock("@/features/notifications/components/notification-bell", () => ({
  NotificationBell: () => createElement("button", { type: "button", "aria-label": "Notifications" }),
}));

/** Clicks a link and reports whether anything blocked its navigation (jsdom cannot navigate, so the
 * default action is stopped after the check). */
function clickNavigates(link: HTMLElement): boolean {
  let prevented = true;
  const observe = (event: Event) => {
    prevented = event.defaultPrevented;
    event.preventDefault();
  };
  document.addEventListener("click", observe);
  fireEvent.click(link);
  document.removeEventListener("click", observe);
  return !prevented;
}

describe("sidebar board hierarchy", () => {
  it("shows the main pages, folders and boards", async () => {
    render(createElement(MantineProvider, { env: "test" }, createElement(AppSidebar)));
    for (const [name, href] of [[/Home/, "/today"], [/My Tasks/, "/my-tasks"], [/Calendar/, "/calendar"], [/Inbox/, "/inbox"], [/Reports/, "/reports"]] as const) {
        expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    }
    expect(screen.getByRole("link", { name: /My Tasks/ })).toHaveTextContent("8");
    const primaryHrefs = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"))
      .filter((href) => ["/today", "/inbox", "/my-tasks", "/calendar", "/reports"].includes(href ?? ""));
    expect(primaryHrefs).toEqual(["/today", "/inbox", "/my-tasks", "/calendar", "/reports"]);
    expect(screen.queryByRole("button", { name: "Manage boards" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Boards/ })).toHaveAttribute("href", "/boards");
    const boards = await screen.findByLabelText("Your boards");
    expect(screen.getByRole("button", { name: "New board in Work" })).toBeInTheDocument();
    expect(boards.className).toContain("ml-3");
    expect(boards.className).toContain("border-l");
    expect(screen.getByRole("link", { name: /Personal/ }).className).toContain("text-xs");
  });

  it("keeps board links navigating on click with drag and drop enabled", async () => {
    render(createElement(MantineProvider, { env: "test" }, createElement(AppSidebar)));
    await screen.findByLabelText("Your boards");
    const link = screen.getByRole("link", { name: /Personal/ });
    expect(link).toHaveAttribute("href", "/boards/board-1");
    expect(clickNavigates(link)).toBe(true);
  });
});
