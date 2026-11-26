import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, useState, type ReactNode } from "react";

import { OPEN_TASK_EVENT } from "@/lib/open-task-event";

import type { SearchResponse, SearchResult } from "../types";
import { GlobalSearchProvider } from "./global-search-provider";
import { SearchField } from "./search-field";

const mockSearch = jest.fn();
const mockPush = jest.fn();
const mockRoute = { pathname: "/today" };
const mockChrome = {
  isDesktop: true,
  mobileSidebarOpened: false,
  openSidebar: jest.fn(),
};

jest.mock("@/lib/api-client", () => ({
  ApiError: class ApiError extends Error {},
  apiClient: { search: (...args: unknown[]) => mockSearch(...args) },
}));

jest.mock("@/lib/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockRoute.pathname,
}));

jest.mock("@/features/shell/components/workspace-chrome", () => ({
  useWorkspaceChrome: () => mockChrome,
}));

const result = (type: SearchResult["type"], id: string, label: string, extra: Partial<SearchResult> = {}): SearchResult => ({
  type,
  id,
  label,
  secondary: null,
  board_id: null,
  board_name: null,
  board_color: null,
  due_date: null,
  is_done: null,
  ...extra,
});

const RESULTS: SearchResponse = {
  query: "rep",
  groups: [
    // Sent out of order on purpose: the field shows tasks, boards, notes, plans.
    { type: "plan", items: [result("plan", "p1", "Reporting plan")], has_more: true },
    {
      type: "task",
      items: [result("task", "t1", "Write report", { board_id: "b1", board_name: "Work", board_color: "blue", due_date: "2026-08-20", is_done: false })],
      has_more: false,
    },
    { type: "board", items: [result("board", "b2", "Reports", { board_id: "b2" })], has_more: false },
    { type: "note", items: [result("note", "n1", "Report ideas", { secondary: "first draft" })], has_more: false },
  ],
};

function wrap(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(
    QueryClientProvider,
    { client },
    createElement(MantineProvider, { env: "test" }, createElement(GlobalSearchProvider, null, children)),
  );
}

const onNavigate = jest.fn();

function renderSidebar() {
  render(
    wrap(
      createElement(
        "div",
        null,
        createElement("nav", null, createElement(SearchField, { onNavigate })),
        createElement(
          "main",
          null,
          createElement("button", { type: "button" }, "Somewhere"),
          createElement("input", { "aria-label": "Task title" }),
          createElement("div", { contentEditable: true, suppressContentEditableWarning: true, "aria-label": "Rich text" }, "Editor"),
        ),
      ),
    ),
  );
}

const ctrlK = (target: Element | Window = window) => fireEvent.keyDown(target, { key: "k", ctrlKey: true });
const field = () => screen.getByRole("combobox", { name: "Search tasks, boards, notes and plans" });

beforeEach(() => {
  mockSearch.mockReset();
  mockPush.mockReset();
  onNavigate.mockReset();
  mockChrome.isDesktop = true;
  mockChrome.mobileSidebarOpened = false;
  mockChrome.openSidebar.mockReset();
  mockRoute.pathname = "/today";
  mockSearch.mockResolvedValue(RESULTS);
  Object.defineProperty(window.navigator, "platform", { value: "Win32", configurable: true });
});

describe("sidebar search field", () => {
  it("is a search field in the sidebar that shows the shortcut", async () => {
    renderSidebar();
    expect(field()).toHaveAttribute("placeholder", "Search");
    expect(field()).toHaveAttribute("aria-keyshortcuts", "Control+K");
    expect(await screen.findByText("Ctrl+K")).toBeInTheDocument();
  });

  it("puts the cursor in the field on Ctrl+K, with no search window", async () => {
    renderSidebar();
    const somewhere = screen.getByRole("button", { name: "Somewhere" });
    somewhere.focus();
    let event: ReturnType<typeof fireEvent.keyDown> = false;
    act(() => {
      event = ctrlK(somewhere);
    });
    // The browser's own Ctrl+K is prevented.
    expect(event).toBe(false);
    await waitFor(() => expect(field()).toHaveFocus());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // An empty field shows nothing: no quick actions, no list.
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.queryByText(/quick actions/i)).not.toBeInTheDocument();
    expect(field()).toHaveAttribute("aria-expanded", "false");
  });

  it("uses Cmd+K on macOS", async () => {
    Object.defineProperty(window.navigator, "platform", { value: "MacIntel", configurable: true });
    renderSidebar();
    act(() => {
      ctrlK();
    });
    expect(field()).not.toHaveFocus();
    act(() => {
      fireEvent.keyDown(window, { key: "k", metaKey: true });
    });
    await waitFor(() => expect(field()).toHaveFocus());
  });

  it("leaves Ctrl+K alone while typing in another field or editor", () => {
    renderSidebar();
    const title = screen.getByRole("textbox", { name: "Task title" });
    title.focus();
    act(() => {
      ctrlK(title);
    });
    expect(title).toHaveFocus();
    const editor = screen.getByText("Editor");
    act(() => {
      ctrlK(editor);
    });
    expect(field()).not.toHaveFocus();
  });

  it("shows grouped results under the field as you type", async () => {
    const user = userEvent.setup();
    renderSidebar();
    await user.click(field());
    await user.type(field(), "rep");
    expect(await screen.findByText("Write report")).toBeInTheDocument();
    expect(mockSearch).toHaveBeenLastCalledWith({ query: "rep", limit: 5 }, expect.anything());
    const list = screen.getByRole("listbox", { name: "Search results" });
    expect(field()).toHaveAttribute("aria-expanded", "true");
    expect(field()).toHaveAttribute("aria-controls", list.id);
    const groups = screen.getAllByRole("group").map((group) => group.getAttribute("aria-labelledby"));
    expect(groups.map((id) => document.getElementById(id ?? "")?.textContent)).toEqual(["Tasks", "Boards", "Notes", "Plans"]);
    expect(screen.getByText("Work")).toBeInTheDocument();
    expect(screen.getByText("first draft")).toBeInTheDocument();
    expect(screen.getByText(/More matches exist/)).toBeInTheDocument();
  });

  it("moves through results with the arrow keys and opens one with Enter", async () => {
    const user = userEvent.setup();
    renderSidebar();
    await user.click(field());
    await user.type(field(), "rep");
    await screen.findByText("Write report");
    // The first result starts active.
    expect(field()).toHaveAttribute("aria-activedescendant", expect.stringContaining("task-t1"));
    await user.keyboard("{ArrowDown}");
    expect(field()).toHaveAttribute("aria-activedescendant", expect.stringContaining("board-b2"));
    await user.keyboard("{ArrowUp}{ArrowUp}");
    // Wraps around to the last result.
    expect(field()).toHaveAttribute("aria-activedescendant", expect.stringContaining("plan-p1"));
    await user.keyboard("{Enter}");
    expect(mockPush).toHaveBeenCalledWith("/plans/p1");
    expect(onNavigate).toHaveBeenCalled();
    expect(field()).toHaveValue("");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("opens a task on its board, or asks the open board to show it", async () => {
    const user = userEvent.setup();
    renderSidebar();
    await user.click(field());
    await user.type(field(), "rep");
    await user.click(await screen.findByText("Write report"));
    expect(mockPush).toHaveBeenCalledWith("/boards/b1?task=t1");

    mockRoute.pathname = "/boards/b1";
    const listener = jest.fn();
    window.addEventListener(OPEN_TASK_EVENT, listener);
    await user.click(field());
    await user.type(field(), "rep");
    await user.click(await screen.findByText("Write report"));
    window.removeEventListener(OPEN_TASK_EVENT, listener);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it("opens notes in the notepad", async () => {
    const user = userEvent.setup();
    renderSidebar();
    await user.click(field());
    await user.type(field(), "rep");
    await user.click(await screen.findByText("Report ideas"));
    expect(mockPush).toHaveBeenCalledWith("/notepad?note=n1");
  });

  it("clears the text with Escape, then gives focus back to where it was", async () => {
    const user = userEvent.setup();
    renderSidebar();
    const somewhere = screen.getByRole("button", { name: "Somewhere" });
    somewhere.focus();
    act(() => {
      ctrlK(somewhere);
    });
    await waitFor(() => expect(field()).toHaveFocus());
    await user.type(field(), "rep");
    await screen.findByText("Write report");
    await user.keyboard("{Escape}");
    expect(field()).toHaveValue("");
    expect(field()).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(somewhere).toHaveFocus();
  });

  it("leaves the field when Ctrl+K is pressed in it", async () => {
    renderSidebar();
    const somewhere = screen.getByRole("button", { name: "Somewhere" });
    somewhere.focus();
    act(() => {
      ctrlK(somewhere);
    });
    await waitFor(() => expect(field()).toHaveFocus());
    act(() => {
      ctrlK(field());
    });
    expect(somewhere).toHaveFocus();
  });

  it("says when nothing matches, and offers a retry when the search fails", async () => {
    const user = userEvent.setup();
    mockSearch.mockResolvedValueOnce({ query: "zzz", groups: [] });
    renderSidebar();
    await user.click(field());
    await user.type(field(), "zzz");
    expect(await screen.findByText("No matches for “zzz”", { selector: "p" })).toBeInTheDocument();

    mockSearch.mockRejectedValueOnce(new Error("offline"));
    await user.clear(field());
    await user.type(field(), "xyz");
    expect(await screen.findByRole("button", { name: "Retry" })).toBeInTheDocument();
    mockSearch.mockResolvedValueOnce(RESULTS);
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Write report")).toBeInTheDocument();
    // Retrying did not take focus away from the field.
    expect(field()).toHaveFocus();
  });
});

describe("on a small screen", () => {
  it("opens the navigation and focuses its search field on Ctrl+K", async () => {
    mockChrome.isDesktop = false;
    // The navigation (and the field in it) only exists once it is open.
    function SmallScreen() {
      const [open, setOpen] = useState(false);
      mockChrome.openSidebar.mockImplementation(() => setOpen(true));
      return createElement(
        "div",
        null,
        open ? createElement(SearchField, { onNavigate }) : null,
        createElement("button", { type: "button" }, "Somewhere"),
      );
    }
    render(wrap(createElement(SmallScreen)));
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    act(() => {
      ctrlK();
    });
    expect(mockChrome.openSidebar).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(field()).toHaveFocus());
    // Marked so the navigation's focus trap starts here, not on its first button.
    expect(field()).toHaveAttribute("data-autofocus", "true");
  });
});
