import { MantineProvider } from "@mantine/core";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, forwardRef, type ReactNode } from "react";

import { AppSidebar } from "./app-sidebar";

/** What the mocked @dnd-kit/react saw: the provider's handlers and every draggable/droppable. */
interface MockDnd {
  provider: {
    onDragStart?: (event: unknown) => void;
    onDragEnd?: (event: unknown) => void;
  } | null;
  draggables: Map<string, { disabled?: boolean; data?: unknown; type?: string }>;
  droppables: Map<string, { data?: unknown; accept?: unknown }>;
  /** Id of the droppable that reports isDropTarget. */
  over: string | null;
}

const mockDnd: MockDnd = { provider: null, draggables: new Map(), droppables: new Map(), over: null };
const mockMoveBoard = jest.fn();
const mockNotifyApiError = jest.fn();

jest.mock("@dnd-kit/react", () => ({
  DragDropProvider: (props: { children: ReactNode }) => {
    mockDnd.provider = props as MockDnd["provider"];
    return props.children;
  },
  useDraggable: (input: { id: string; disabled?: boolean; data?: unknown; type?: string }) => {
    mockDnd.draggables.set(input.id, input);
    return { ref: () => undefined, isDragging: false };
  },
  useDroppable: (input: { id: string; data?: unknown; accept?: unknown }) => {
    mockDnd.droppables.set(input.id, input);
    return { ref: () => undefined, isDropTarget: mockDnd.over === input.id };
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

jest.mock("@/lib/navigation", () => ({ usePathname: () => "/today" }));

// The search field is tested on its own (search-field.test.tsx).
jest.mock("@/features/search/components/search-field", () => ({
  SearchField: () => createElement("input", { "aria-label": "Search tasks, boards, notes and plans" }),
}));

jest.mock("@/lib/notify", () => ({
  notifyApiError: (...args: unknown[]) => mockNotifyApiError(...args),
  notifySuccess: jest.fn(),
}));

jest.mock("@/features/auth/components/auth-provider", () => ({
  useAuth: () => ({ user: { display_name: "Ada", login_id: "ada" }, logout: jest.fn() }),
}));

const board = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  color: "teal",
  icon_name: "home",
  archived_at: null,
  position: 0,
  folder_id: null,
  ...extra,
});

jest.mock("@/features/board/hooks/use-boards", () => ({
  useBoards: () => ({
    data: [
      board("board-1", "Personal"),
      board("board-2", "Roadmap", { folder_id: "folder-1" }),
      board("board-3", "Old stuff", { folder_id: "folder-3" }),
      board("board-4", "Team board", { role: "member", owner_name: "Bo" }),
    ],
  }),
  activeBoards: (boards: unknown[] | undefined) => boards ?? [],
}));

jest.mock("@/features/board/hooks/use-board-folders", () => ({
  useBoardFolders: () => ({
    data: [
      { id: "folder-1", name: "Work", position: 0 },
      { id: "folder-2", name: "Projects", position: 1 },
      { id: "folder-3", name: "Archive", position: 2 },
    ],
  }),
  useBoardFolderMutations: () => ({
    create: { isPending: false },
    rename: { isPending: false },
    remove: { isPending: false },
    moveBoard: { mutate: (...args: unknown[]) => mockMoveBoard(...args) },
  }),
  boardsInFolder: (boards: Array<{ folder_id?: string | null }>, _ids: Set<string>, id: string | null) =>
    boards.filter((item) => (item.folder_id ?? null) === id),
}));

jest.mock("../hooks/use-sidebar-counts", () => ({ useSidebarCounts: () => ({ myTasks: 0, inbox: 0 }) }));

jest.mock("@/features/notifications/components/notification-bell", () => ({
  NotificationBell: () => createElement("button", { type: "button", "aria-label": "Notifications" }),
}));

function renderSidebar() {
  return render(createElement(MantineProvider, { env: "test" }, createElement(AppSidebar)));
}

function dragSource(boardId: string) {
  const draggable = mockDnd.draggables.get(`sidebar-board:${boardId}`);
  if (!draggable) throw new Error(`board ${boardId} is not draggable`);
  return { id: `sidebar-board:${boardId}`, type: draggable.type, data: draggable.data };
}

function startDrag(boardId: string, over: string | null = null) {
  mockDnd.over = over;
  act(() => mockDnd.provider?.onDragStart?.({ operation: { source: dragSource(boardId), target: null } }));
}

function drop(boardId: string, targetId: string | null, canceled = false) {
  const target = targetId ? mockDnd.droppables.get(targetId) : null;
  if (targetId && !target) throw new Error(`no drop target ${targetId}`);
  act(() =>
    mockDnd.provider?.onDragEnd?.({
      operation: { source: dragSource(boardId), target: target ? { id: targetId, data: target.data } : null },
      canceled,
    }),
  );
  mockDnd.over = null;
}

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

const folderZone = (container: HTMLElement, folderId: string) =>
  container.querySelector(`[data-folder-drop="${folderId}"]`) as HTMLElement;

beforeEach(() => {
  mockDnd.provider = null;
  mockDnd.draggables.clear();
  mockDnd.droppables.clear();
  mockDnd.over = null;
  mockMoveBoard.mockReset();
  mockNotifyApiError.mockReset();
  window.localStorage.clear();
});

describe("sidebar board drag and drop", () => {
  it("moves an ungrouped board into a folder", async () => {
    renderSidebar();
    await screen.findByLabelText("Your boards");
    startDrag("board-1");
    drop("board-1", "board-folder:folder-1");
    expect(mockMoveBoard).toHaveBeenCalledTimes(1);
    expect(mockMoveBoard.mock.calls[0][0]).toEqual({ boardId: "board-1", folderId: "folder-1" });
  });

  it("moves a board from one folder to another", async () => {
    renderSidebar();
    await screen.findByLabelText("Your boards");
    startDrag("board-2");
    drop("board-2", "board-folder:folder-3");
    expect(mockMoveBoard.mock.calls[0][0]).toEqual({ boardId: "board-2", folderId: "folder-3" });
  });

  it("moves a board back to the ungrouped area", async () => {
    const { container } = renderSidebar();
    await screen.findByLabelText("Your boards");
    startDrag("board-2", "board-folder:none");
    expect(screen.getByText("Drop here to remove from its folder")).toBeInTheDocument();
    expect(folderZone(container, "none")).toHaveAttribute("data-drop-target", "true");
    drop("board-2", "board-folder:none");
    expect(mockMoveBoard.mock.calls[0][0]).toEqual({ boardId: "board-2", folderId: null });
    expect(screen.queryByText("Drop here to remove from its folder")).not.toBeInTheDocument();
  });

  it("accepts drops on empty and collapsed folders", async () => {
    window.localStorage.setItem("life-management:collapsed-folders", JSON.stringify(["folder-3"]));
    const { container } = renderSidebar();
    await screen.findByLabelText("Your boards");
    expect(screen.getByRole("button", { name: "Show or hide folder Archive" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: /Old stuff/ })).not.toBeInTheDocument();
    expect(within(folderZone(container, "folder-2")).getByText("No boards yet")).toBeInTheDocument();
    for (const id of ["folder-1", "folder-2", "folder-3", "none"]) {
      expect(mockDnd.droppables.get(`board-folder:${id}`)?.accept).toBe("sidebar-board");
    }

    startDrag("board-1", "board-folder:folder-2");
    expect(folderZone(container, "folder-2")).toHaveAttribute("data-drop-target", "true");
    drop("board-1", "board-folder:folder-2");

    startDrag("board-1", "board-folder:folder-3");
    expect(folderZone(container, "folder-3")).toHaveAttribute("data-drop-target", "true");
    drop("board-1", "board-folder:folder-3");

    expect(mockMoveBoard.mock.calls.map((call) => call[0])).toEqual([
      { boardId: "board-1", folderId: "folder-2" },
      { boardId: "board-1", folderId: "folder-3" },
    ]);
  });

  it("only highlights targets that would move the board", async () => {
    const { container } = renderSidebar();
    await screen.findByLabelText("Your boards");
    startDrag("board-2", "board-folder:folder-1");
    expect(folderZone(container, "folder-1")).not.toHaveAttribute("data-drop-target");
    drop("board-2", "board-folder:folder-1");
    startDrag("board-1", null);
    drop("board-1", null);
    startDrag("board-1");
    drop("board-1", "board-folder:folder-1", true);
    expect(mockMoveBoard).not.toHaveBeenCalled();
  });

  it("keeps shared boards from being dragged or moved", async () => {
    renderSidebar();
    await screen.findByLabelText("Your boards");
    expect(mockDnd.draggables.get("sidebar-board:board-4")?.disabled).toBe(true);
    expect(mockDnd.draggables.get("sidebar-board:board-1")?.disabled).toBe(false);
    expect(screen.queryByRole("button", { name: "Move Team board to a folder" })).not.toBeInTheDocument();
    const shared = screen.getByRole("link", { name: /Team board/ });
    expect(shared.parentElement).not.toHaveAttribute("data-board-draggable");
  });

  it("keeps board links clickable and the (...) menu working", async () => {
    const user = userEvent.setup();
    renderSidebar();
    await screen.findByLabelText("Your boards");
    const link = screen.getByRole("link", { name: /Personal/ });
    expect(link).toHaveAttribute("href", "/boards/board-1");
    expect(link).toHaveAttribute("draggable", "false");
    expect(clickNavigates(link)).toBe(true);
    expect(mockMoveBoard).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Move Personal to a folder" }));
    await user.click(await screen.findByRole("menuitem", { name: "Projects" }));
    expect(mockMoveBoard.mock.calls[0][0]).toEqual({ boardId: "board-1", folderId: "folder-2" });
  });

  it("shows the API error when a move fails", async () => {
    const failure = new Error("Folder not found");
    mockMoveBoard.mockImplementation((_variables: unknown, options?: { onError?: (error: unknown) => void }) =>
      options?.onError?.(failure),
    );
    renderSidebar();
    await screen.findByLabelText("Your boards");
    startDrag("board-1");
    drop("board-1", "board-folder:folder-1");
    expect(mockNotifyApiError).toHaveBeenCalledWith(failure, "Could not save the change");
  });
});
