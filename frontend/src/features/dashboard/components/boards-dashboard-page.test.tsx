import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DashboardSummary } from "../types";
import { BoardsDashboardPage } from "./boards-dashboard-page";

const summaryQuery = vi.hoisted(() => ({
  isLoading: false,
  isError: false,
  data: null as DashboardSummary | null,
  refetch: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement("a", { href }, children),
}));

vi.mock("@/features/shell/components/workspace-chrome", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/shell/components/workspace-chrome")>();
  return {
    ...actual,
    useWorkspaceChrome: () => ({
      openNewBoard: vi.fn(),
      openManageBoards: vi.fn(),
      openSidebar: vi.fn(),
      toggleSidebar: vi.fn(),
      closeSidebar: vi.fn(),
      sidebarOpened: false,
    }),
  };
});

vi.mock("../hooks/use-dashboard", () => ({
  useDashboardSummary: () => summaryQuery,
}));

function sample(): DashboardSummary {
  return {
    today: "2026-08-20",
    active_boards: 2,
    total_tasks: 10,
    open_tasks: 6,
    completed_tasks: 4,
    completion_rate: 0.4,
    overdue: 1,
    due_today: 2,
    boards: [
      {
        id: "board-work",
        name: "Work",
        color: "blue",
        icon_name: "briefcase",
        total: 7,
        open: 4,
        completed: 3,
        completion_rate: 0.43,
        overdue: 1,
        due_today: 1,
        status_count: 3,
      },
      {
        id: "board-home",
        name: "Personal",
        color: "teal",
        icon_name: "home",
        total: 3,
        open: 2,
        completed: 1,
        completion_rate: 0.33,
        overdue: 0,
        due_today: 1,
        status_count: 3,
      },
    ],
    priority: { high: 3, medium: 5, low: 2 },
    attention: {
      overdue: [
        {
          id: "task-overdue",
          title: "Pay rent",
          due_date: "2026-08-10",
          priority: "high",
          board_id: "board-home",
          board_name: "Personal",
          status_id: "status-todo",
          status_name: "Todo",
        },
      ],
      due_today: [
        {
          id: "task-today",
          title: "Write brief",
          due_date: "2026-08-20",
          priority: "medium",
          board_id: "board-work",
          board_name: "Work",
          status_id: "status-todo",
          status_name: "Todo",
        },
      ],
    },
  };
}

function wrap(ui: ReactNode) {
  return render(createElement(MantineProvider, { env: "test" }, ui));
}

describe("Boards dashboard", () => {
  beforeEach(() => {
    summaryQuery.isLoading = false;
    summaryQuery.isError = false;
    summaryQuery.data = sample();
    summaryQuery.refetch.mockReset();
  });

  it("renders four panels and keeps New/Manage in the header", () => {
    wrap(createElement(BoardsDashboardPage));
    expect(screen.getByRole("heading", { name: "Boards" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Recurring tasks" })).toHaveAttribute(
      "href",
      "/boards/recurring",
    );
    expect(screen.getByRole("button", { name: "New board" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Manage boards" })).toBeInTheDocument();
    const grid = screen.getByLabelText("Boards dashboard");
    expect(grid.className).toContain("grid-cols-1");
    expect(grid.className).toContain("md:grid-cols-2");
    expect(screen.getByLabelText("Overview")).toBeInTheDocument();
    expect(screen.getByLabelText("Board progress")).toBeInTheDocument();
    expect(screen.getByLabelText("Workload")).toBeInTheDocument();
    expect(screen.getByLabelText("Needs attention")).toBeInTheDocument();
    expect(screen.getByText("Active boards")).toBeInTheDocument();
    expect(screen.getByText("Completion rate")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Work/ })).toHaveAttribute("href", "/boards/board-work");
    expect(screen.getAllByText("High").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Pay rent")).toBeInTheDocument();
    expect(screen.queryByText("Write brief")).not.toBeInTheDocument();
  });

  it("switches the attention list between Overdue and Due today", async () => {
    const user = userEvent.setup();
    wrap(createElement(BoardsDashboardPage));
    await user.click(screen.getByRole("tab", { name: /Due today/ }));
    expect(screen.getByText("Write brief")).toBeInTheDocument();
    expect(screen.queryByText("Pay rent")).not.toBeInTheDocument();
  });
});
