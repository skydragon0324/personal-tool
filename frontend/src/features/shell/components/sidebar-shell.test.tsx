import { MantineProvider } from "@mantine/core";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, forwardRef, type ReactNode } from "react";

import { BOARDS_NAV_COLLAPSED_KEY } from "../utils/boards-nav";
import { SIDEBAR_COLLAPSED_KEY, SIDEBAR_ID, compactCount, readSidebarCollapsed } from "../utils/sidebar-preference";
import { LifeManagementShell } from "./life-management-shell";
import { MobileSidebarButton } from "./workspace-chrome";

// ---- Browser API mocks -------------------------------------------------------------------------

type Listener = (event: { matches: boolean; media: string }) => void;
const viewport = { desktop: true, reduceMotion: false, listeners: [] as Array<{ query: string; listener: Listener }> };
const originalMatchMedia = window.matchMedia;

function matches(query: string): boolean {
  if (query.includes("min-width")) return viewport.desktop;
  if (query.includes("prefers-reduced-motion")) return viewport.reduceMotion;
  return false;
}

function installMatchMedia() {
  window.matchMedia = ((query: string) => ({
    get matches() {
      return matches(query);
    },
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: Listener) => viewport.listeners.push({ query, listener }),
    removeEventListener: (_type: string, listener: Listener) => {
      viewport.listeners = viewport.listeners.filter((item) => item.listener !== listener);
    },
    addListener: (listener: Listener) => viewport.listeners.push({ query, listener }),
    removeListener: (listener: Listener) => {
      viewport.listeners = viewport.listeners.filter((item) => item.listener !== listener);
    },
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

/** Simulates the browser crossing the `sm` breakpoint. */
function resizeTo(desktop: boolean) {
  viewport.desktop = desktop;
  act(() => {
    viewport.listeners
      .filter((item) => item.query.includes("min-width"))
      .forEach((item) => item.listener({ matches: desktop, media: item.query }));
  });
}

// ---- Module mocks ------------------------------------------------------------------------------

const mockRoute = { pathname: "/today" };
const mockMoveBoard = jest.fn();
const mockDnd: {
  onDragEnd?: (event: unknown) => void;
  draggables: Map<string, { data?: unknown }>;
  droppables: Map<string, { data?: unknown }>;
} = { draggables: new Map(), droppables: new Map() };

jest.mock("@dnd-kit/react", () => ({
  DragDropProvider: (props: { children: ReactNode; onDragEnd?: (event: unknown) => void }) => {
    mockDnd.onDragEnd = props.onDragEnd;
    return props.children;
  },
  useDraggable: (input: { id: string; data?: unknown }) => {
    mockDnd.draggables.set(input.id, input);
    return { ref: () => undefined, isDragging: false };
  },
  useDroppable: (input: { id: string; data?: unknown }) => {
    mockDnd.droppables.set(input.id, input);
    return { ref: () => undefined, isDropTarget: false };
  },
  PointerSensor: { configure: (options: unknown) => options },
  KeyboardSensor: {
    configure: (options: unknown) => options,
    defaults: { keyboardCodes: { start: ["Space", "Enter"], cancel: ["Escape"], end: ["Space", "Enter", "Tab"] } },
  },
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: forwardRef<HTMLAnchorElement, { href: string; children: ReactNode }>(function MockLink({ href, children, ...props }, ref) {
    return createElement("a", { href, ref, ...props }, children);
  }),
}));

jest.mock("@/lib/navigation", () => ({
  usePathname: () => mockRoute.pathname,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

jest.mock("@/features/auth/components/auth-provider", () => ({
  useAuth: () => ({ user: { display_name: "Ada Lovelace", login_id: "ada" }, logout: jest.fn() }),
}));

jest.mock("@/features/board/hooks/use-boards", () => ({
  useBoards: () => ({
    data: [
      { id: "board-1", name: "Personal", color: "teal", icon_name: "home", archived_at: null, position: 0, folder_id: null },
      { id: "board-2", name: "Roadmap", color: "blue", icon_name: "home", archived_at: null, position: 1, folder_id: "folder-1" },
    ],
  }),
  activeBoards: (boards: unknown[] | undefined) => boards ?? [],
}));

jest.mock("@/features/board/hooks/use-board-folders", () => ({
  useBoardFolders: () => ({ data: [{ id: "folder-1", name: "Work", position: 0 }] }),
  useBoardFolderMutations: () => ({
    create: { isPending: false },
    rename: { isPending: false },
    remove: { isPending: false },
    moveBoard: { mutate: (...args: unknown[]) => mockMoveBoard(...args) },
  }),
  boardsInFolder: (boards: Array<{ folder_id?: string | null }>, _ids: Set<string>, id: string | null) =>
    boards.filter((item) => (item.folder_id ?? null) === id),
}));

jest.mock("../hooks/use-sidebar-counts", () => ({ useSidebarCounts: () => ({ myTasks: 8, inbox: 120 }) }));

jest.mock("@/features/notifications/components/notification-bell", () => ({
  NotificationBell: () => createElement("button", { type: "button", "aria-label": "Notifications" }),
}));
jest.mock("@/features/notifications/components/notification-bridge", () => ({ NotificationBridge: () => null }));
jest.mock("@/features/board/components/new-board-modal", () => ({ NewBoardModal: () => null }));
jest.mock("@/features/board/components/manage-boards-modal", () => ({ ManageBoardsModal: () => null }));
// The search field is tested on its own (search-field.test.tsx); it needs a query client.
jest.mock("@/features/search/components/search-field", () => ({
  SearchField: () => createElement("input", { "aria-label": "Search tasks, boards, notes and plans" }),
}));

// ---- Helpers -----------------------------------------------------------------------------------

function renderShell() {
  return render(
    createElement(
      MantineProvider,
      { env: "test" },
      createElement(
        LifeManagementShell,
        null,
        createElement("header", null, createElement(MobileSidebarButton), createElement("h1", null, "Page")),
      ),
    ),
  );
}

const sidebar = () => document.getElementById(SIDEBAR_ID);
const rail = () => document.querySelector("[data-sidebar-rail]");
const toggle = (name: string | RegExp) => screen.getByRole("button", { name });
const menuButton = () => screen.getByRole("button", { name: /^(Open|Close) navigation$/, expanded: undefined });

/** Clicks a link without letting jsdom try to navigate. */
function clickLink(link: HTMLElement) {
  const stop = (event: Event) => event.preventDefault();
  document.addEventListener("click", stop);
  fireEvent.click(link);
  document.removeEventListener("click", stop);
}

beforeEach(() => {
  viewport.desktop = true;
  viewport.reduceMotion = false;
  viewport.listeners = [];
  installMatchMedia();
  mockRoute.pathname = "/today";
  mockMoveBoard.mockReset();
  mockDnd.draggables.clear();
  mockDnd.droppables.clear();
  window.localStorage.clear();
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
  window.localStorage.clear();
  document.body.removeAttribute("data-scroll-locked");
  document.body.removeAttribute("style");
});

// ---- Large screens -----------------------------------------------------------------------------

describe("large-screen sidebar", () => {
  it("shows the complete sidebar with a labelled toggle by default", () => {
    renderShell();
    const button = toggle("Collapse sidebar");
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(button).toHaveAttribute("aria-controls", SIDEBAR_ID);
    expect(sidebar()).toHaveAttribute("data-sidebar-state", "expanded");
    expect(sidebar()).toHaveStyle({ width: "272px" });
    expect(screen.getByText("My Tasks")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Personal/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Your boards")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Account settings for Ada Lovelace" })).toBeInTheDocument();
    expect(rail()).toBeNull();
    // Not a drawer: no dialog and no page scroll lock.
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("collapses to an icon rail and expands again, saving the choice", async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(toggle("Collapse sidebar"));

    expect(rail()).not.toBeNull();
    expect(sidebar()).toHaveAttribute("data-sidebar-state", "collapsed");
    expect(sidebar()).toHaveStyle({ width: "60px" });
    expect(screen.queryByLabelText("Your boards")).toBeNull();
    expect(screen.queryByRole("link", { name: /Personal/ })).toBeNull();
    expect(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe("true");
    const expand = toggle("Expand sidebar");
    expect(expand).toHaveAttribute("aria-expanded", "false");
    expect(expand).toHaveAttribute("aria-controls", SIDEBAR_ID);
    // Keyboard users stay on the toggle although the button was replaced.
    await waitFor(() => expect(expand).toHaveFocus());

    await user.click(expand);
    expect(rail()).toBeNull();
    expect(screen.getByLabelText("Your boards")).toBeInTheDocument();
    expect(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe("false");
    await waitFor(() => expect(toggle("Collapse sidebar")).toHaveFocus());
  });

  it("restores the saved preference on the very first render", () => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "true");
    renderShell();
    // No expanded frame first: the rail is there straight away.
    expect(rail()).not.toBeNull();
    expect(screen.queryByLabelText("Your boards")).toBeNull();
  });

  it("keeps the sidebar preference apart from the Boards section preference", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(BOARDS_NAV_COLLAPSED_KEY, "true");
    renderShell();
    // Boards section collapsed, sidebar expanded.
    expect(rail()).toBeNull();
    expect(screen.queryByLabelText("Your boards")).toBeNull();

    await user.click(toggle("Collapse sidebar"));
    await user.click(toggle("Expand sidebar"));
    expect(window.localStorage.getItem(BOARDS_NAV_COLLAPSED_KEY)).toBe("true");

    await user.click(screen.getByRole("button", { name: "Expand boards" }));
    expect(window.localStorage.getItem(BOARDS_NAV_COLLAPSED_KEY)).toBe("false");
    expect(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe("false");
    expect(SIDEBAR_COLLAPSED_KEY).not.toBe(BOARDS_NAV_COLLAPSED_KEY);
  });

  it("names every rail destination and marks the current page", () => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "true");
    mockRoute.pathname = "/calendar";
    renderShell();
    const nav = within(rail() as HTMLElement).getByRole("navigation", { name: "Application" });
    const names = within(nav)
      .getAllByRole("link")
      .map((link) => link.getAttribute("aria-label"));
    expect(names).toEqual(["Home", "Inbox (120)", "My Tasks (8)", "Calendar", "Reports", "Boards", "Plans", "Notepad", "Schedule"]);
    const calendar = within(nav).getByRole("link", { name: "Calendar" });
    expect(calendar).toHaveAttribute("aria-current", "page");
    expect(calendar.className).toContain("bg-[var(--app-primary-soft)]");
    expect(within(nav).getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
    // Compact counters: the number is visible, capped at 99+.
    expect(within(nav).getByText("8")).toBeInTheDocument();
    expect(within(nav).getByText("99+")).toBeInTheDocument();
    // Account entry near the bottom.
    expect(screen.getByRole("button", { name: "Account settings for Ada Lovelace" })).toHaveTextContent("AL");
  });

  it("marks Boards as current on any board page while collapsed", () => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "true");
    mockRoute.pathname = "/boards/board-1";
    renderShell();
    expect(screen.getByRole("link", { name: "Boards" })).toHaveAttribute("aria-current", "page");
  });

  it("shows a tooltip on hover and on keyboard focus", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "true");
    renderShell();
    await user.hover(screen.getByRole("link", { name: "Calendar" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Calendar");
    await user.unhover(screen.getByRole("link", { name: "Calendar" }));
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());

    act(() => screen.getByRole("link", { name: "Inbox (120)" }).focus());
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Inbox (120)");
  });

  it("opens the search field beside the rail from its icon or with Ctrl+K", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "true");
    renderShell();
    const searchName = "Search tasks, boards, notes and plans";
    expect(screen.queryByRole("textbox", { name: searchName })).toBeNull();
    const icon = within(rail() as HTMLElement).getByRole("button", { name: "Search" });
    expect(icon).toHaveAttribute("aria-keyshortcuts");
    await user.click(icon);
    expect(await screen.findByRole("textbox", { name: searchName })).toBeInTheDocument();
    await user.click(icon);
    await waitFor(() => expect(screen.queryByRole("textbox", { name: searchName })).toBeNull());

    act(() => {
      fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    });
    expect(await screen.findByRole("textbox", { name: searchName })).toBeInTheDocument();
    // The sidebar stays collapsed.
    expect(rail()).not.toBeNull();
    expect(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe("true");
  });

  it("stays collapsed while moving between pages", () => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "true");
    const view = renderShell();
    mockRoute.pathname = "/plans";
    view.rerender(
      createElement(
        MantineProvider,
        { env: "test" },
        createElement(LifeManagementShell, null, createElement("h1", null, "Plans page")),
      ),
    );
    expect(rail()).not.toBeNull();
    expect(screen.getByRole("link", { name: "Plans" })).toHaveAttribute("aria-current", "page");
  });

  it("animates its width unless the user prefers reduced motion", () => {
    renderShell();
    // CSS transition, switched off by `prefers-reduced-motion: reduce` (Tailwind's motion-reduce).
    expect(sidebar()?.className).toContain("transition-[width]");
    expect(sidebar()?.className).toContain("motion-reduce:transition-none");
  });

  it("keeps board-to-folder drag and drop working in the expanded sidebar", async () => {
    const user = userEvent.setup();
    renderShell();
    // Collapse and expand first: the tree is mounted again and must still work.
    await user.click(toggle("Collapse sidebar"));
    await user.click(toggle("Expand sidebar"));
    const source = mockDnd.draggables.get("sidebar-board:board-1");
    const target = mockDnd.droppables.get("board-folder:folder-1");
    expect(source && target).toBeTruthy();
    act(() =>
      mockDnd.onDragEnd?.({
        canceled: false,
        operation: { source: { data: source?.data }, target: { id: "board-folder:folder-1", data: target?.data } },
      }),
    );
    expect(mockMoveBoard).toHaveBeenCalledWith({ boardId: "board-1", folderId: "folder-1" }, expect.anything());
  });
});

// ---- Small screens -----------------------------------------------------------------------------

describe("small-screen drawer", () => {
  beforeEach(() => {
    viewport.desktop = false;
  });

  async function openDrawer() {
    const user = userEvent.setup();
    renderShell();
    const button = menuButton();
    await user.click(button);
    const dialog = await screen.findByRole("dialog", { name: "Application" });
    return { user, button, dialog };
  }

  it("is closed by default with no rail and a menu button in the page", () => {
    renderShell();
    expect(rail()).toBeNull();
    expect(sidebar()).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    const button = menuButton();
    expect(button).toHaveAccessibleName("Open navigation");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveAttribute("aria-controls", SIDEBAR_ID);
  });

  it("opens the full sidebar over the page with a backdrop and locks page scrolling", async () => {
    const { button, dialog } = await openDrawer();
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(within(dialog).getByLabelText("Your boards")).toBeInTheDocument();
    expect(within(dialog).getByText("My Tasks")).toBeInTheDocument();
    expect(document.querySelector("[data-sidebar-backdrop]")).not.toBeNull();
    expect(document.body).toHaveAttribute("data-scroll-locked");
    expect(sidebar()).not.toBeNull();
  });

  it("opens with its search field when Ctrl+K is pressed", async () => {
    renderShell();
    const button = menuButton();
    expect(screen.queryByRole("dialog")).toBeNull();
    act(() => {
      fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    });
    const dialog = await screen.findByRole("dialog", { name: "Application" });
    expect(within(dialog).getByRole("textbox", { name: "Search tasks, boards, notes and plans" })).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-expanded", "true");
  });

  it("closes from the drawer's own toggle and gives focus back to the menu button", async () => {
    const { user, button, dialog } = await openDrawer();
    await user.click(within(dialog).getByRole("button", { name: "Close navigation" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(button).toHaveFocus());
    await waitFor(() => expect(document.body).not.toHaveAttribute("data-scroll-locked"));
  });

  it("closes when the backdrop is clicked", async () => {
    const { button } = await openDrawer();
    fireEvent.mouseDown(document.querySelector("[data-sidebar-backdrop]") as Element);
    fireEvent.click(document.querySelector("[data-sidebar-backdrop]") as Element);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(button).toHaveFocus());
    await waitFor(() => expect(document.body).not.toHaveAttribute("data-scroll-locked"));
  });

  it("closes with Escape", async () => {
    const { user, button } = await openDrawer();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(button).toHaveFocus());
  });

  it("closes after choosing a destination or opening a board", async () => {
    const first = await openDrawer();
    clickLink(within(first.dialog).getByRole("link", { name: /My Tasks/ }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await first.user.click(menuButton());
    const dialog = await screen.findByRole("dialog", { name: "Application" });
    clickLink(within(dialog).getByRole("link", { name: /Personal/ }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.body).not.toHaveAttribute("data-scroll-locked"));
  });

  it("never changes the saved large-screen preference", async () => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "true");
    const { user, dialog } = await openDrawer();
    // The drawer always shows the complete sidebar.
    expect(within(dialog).queryByText("My Tasks")).not.toBeNull();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe("true");
  });
});

// ---- Resizing ----------------------------------------------------------------------------------

describe("resizing across the breakpoint", () => {
  it("switches between rail and drawer without leaving an overlay or scroll lock behind", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "true");
    renderShell();
    expect(rail()).not.toBeNull();

    resizeTo(false);
    expect(rail()).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(menuButton());
    expect(await screen.findByRole("dialog", { name: "Application" })).toBeInTheDocument();
    expect(document.body).toHaveAttribute("data-scroll-locked");

    // Growing closes the drawer and brings back the saved (collapsed) sidebar.
    resizeTo(true);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.querySelector("[data-sidebar-backdrop]")).toBeNull();
    await waitFor(() => expect(document.body).not.toHaveAttribute("data-scroll-locked"));
    expect(rail()).not.toBeNull();
    expect(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe("true");

    // Back and forth again.
    for (const desktop of [false, true, false, true]) resizeTo(desktop);
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(document.body).not.toHaveAttribute("data-scroll-locked"));
    expect(rail()).not.toBeNull();

    // Small again: the drawer starts closed.
    resizeTo(false);
    expect(menuButton()).toHaveAttribute("aria-expanded", "false");
  });

  it("restores the expanded sidebar when that was the saved choice", () => {
    renderShell();
    resizeTo(false);
    resizeTo(true);
    expect(sidebar()).toHaveAttribute("data-sidebar-state", "expanded");
    expect(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBeNull();
  });
});

describe("sidebar preference helpers", () => {
  it("reads only an explicit collapsed value and caps counters", () => {
    expect(readSidebarCollapsed({ getItem: () => "true" })).toBe(true);
    expect(readSidebarCollapsed({ getItem: () => null })).toBe(false);
    expect(
      readSidebarCollapsed({
        getItem: () => {
          throw new Error("blocked");
        },
      }),
    ).toBe(false);
    expect(compactCount(7)).toBe("7");
    expect(compactCount(99)).toBe("99");
    expect(compactCount(100)).toBe("99+");
  });
});
