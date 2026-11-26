import { PointerActivationConstraints } from "@dnd-kit/dom";
import { DragDropProvider, KeyboardSensor, PointerSensor, useDraggable, useDroppable } from "@dnd-kit/react";
import { ActionIcon, Button, Group, Menu, Modal, ScrollArea, Text, TextInput } from "@mantine/core";
import Link from "next/link";
import { usePathname } from "@/lib/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { AccountSettingsModal } from "@/features/auth/components/account-settings-modal";
import { useAuth } from "@/features/auth/components/auth-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/features/board/components/theme-toggle";
import { DotsIcon, LeafIcon, PlusIcon } from "@/features/board/components/board-ui-icons";
import { boardsInFolder, useBoardFolderMutations, useBoardFolders } from "@/features/board/hooks/use-board-folders";
import { useBoards, activeBoards } from "@/features/board/hooks/use-boards";
import type { BoardFolder, BoardListItem } from "@/features/board/types";
import { BoardGlyph, boardColorClass } from "@/features/board/utils/board-icons";
import { POINTER_ACTIVATION_DISTANCE } from "@/features/board/utils/pointer-activation";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { SearchField } from "@/features/search/components/search-field";
import { notifyApiError, notifySuccess } from "@/lib/notify";

import { useSidebarCounts } from "../hooks/use-sidebar-counts";
import {
  SIDEBAR_BOARD_DRAG_TYPE,
  canMoveBoardToFolder,
  folderDropId,
  folderMoveFromDrop,
  type BoardDragData,
  type FolderDropData,
} from "../utils/board-folder-drop";
import { boardsGroupExpanded, readBoardsNavCollapsed, writeBoardsNavCollapsed } from "../utils/boards-nav";
import { boardIdFromPath, isBoardsIndexPath, sectionFromPath, type AppSection } from "../utils/navigation";
import { NavIcon, type NavIconName } from "./nav-icons";
import { SidebarToggle } from "./sidebar-toggle";
import { useWorkspaceChrome } from "./workspace-chrome";
import { t } from "@/i18n";

const COLLAPSED_FOLDERS_KEY = "life-management:collapsed-folders";
let savedBoardListScrollTop = 0;

// A short pointer move still counts as a click, so board links keep navigating. Enter keeps
// following the link; Space picks a board up for keyboard dragging.
const BOARD_DRAG_SENSORS = [
  PointerSensor.configure({
    activationConstraints: [new PointerActivationConstraints.Distance({ value: POINTER_ACTIVATION_DISTANCE })],
  }),
  KeyboardSensor.configure({
    keyboardCodes: { ...KeyboardSensor.defaults.keyboardCodes, start: ["Space"] },
  }),
];

type FolderDialog = { mode: "create" } | { mode: "rename"; folder: BoardFolder } | { mode: "delete"; folder: BoardFolder };

export function AppSidebar() {
  const pathname = usePathname();
  const chrome = useWorkspaceChrome();
  const { user, logout } = useAuth();
  const [accountOpen, setAccountOpen] = useState(false);
  const [folderDialog, setFolderDialog] = useState<FolderDialog | null>(null);
  const boardsQuery = useBoards(true);
  const foldersQuery = useBoardFolders();
  const counts = useSidebarCounts();
  const boards = activeBoards(boardsQuery.data);
  const currentBoardId = boardIdFromPath(pathname);
  const section = sectionFromPath(pathname);
  const boardsParentActive = isBoardsIndexPath(pathname);
  const [storedCollapsed, setStoredCollapsed] = useState<boolean | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setStoredCollapsed(readBoardsNavCollapsed(window.localStorage));
    setReady(true);
  }, []);

  const expanded = boardsGroupExpanded(pathname, storedCollapsed);

  function setCollapsed(next: boolean) {
    setStoredCollapsed(next);
    writeBoardsNavCollapsed(next, window.localStorage);
  }

  const close = () => chrome?.closeSidebar();

  return (
    <div className="flex h-full flex-col border-r border-[var(--app-border)] bg-[var(--app-surface)]">
      <div className="flex items-center justify-between gap-1 border-b border-[var(--app-border)] py-4 pl-2 pr-2">
        <div className="flex min-w-0 items-center gap-2">
          <SidebarToggle />
          <LeafIcon size={28} className="shrink-0 text-[var(--app-primary)]" />
          <div className="min-w-0">
            <p className="truncate font-display text-base font-semibold leading-tight text-[var(--app-text)]">
              {t("common.appName")}
            </p>
            <p className="truncate text-[10px] text-[var(--app-text-muted)]">{t("shell.tagline")}</p>
          </div>
        </div>
        <NotificationBell />
      </div>
      <nav aria-label={t("shell.navigation")} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 py-3">
        <div className="mb-2 shrink-0">
          <SearchField onNavigate={close} />
        </div>
        <NavLink href="/today" icon="home" label={t("shell.home")} section="today" current={section} onClick={close} />
        <NavLink href="/inbox" icon="inbox" label={t("shell.inbox")} section="inbox" current={section} count={counts.inbox} onClick={close} />
        <NavLink href="/my-tasks" icon="myTasks" label={t("shell.myTasks")} section="myTasks" current={section} count={counts.myTasks} onClick={close} />
        <NavLink href="/calendar" icon="calendar" label={t("shell.calendar")} section="calendar" current={section} onClick={close} />
        <NavLink href="/reports" icon="reports" label={t("shell.reports")} section="reports" current={section} onClick={close} />
        <div className="my-2 h-px shrink-0 bg-[var(--app-border)]" />
        <div className="flex shrink-0 items-center gap-0.5">
          <Link
            href="/boards"
            aria-current={boardsParentActive ? "page" : undefined}
            onClick={() => {
              setCollapsed(false);
              close();
            }}
            className={`flex-1 ${navItemClass(boardsParentActive)}`}
          >
            <NavIcon name="boards" />
            {t("shell.boards")}
          </Link>
          <Menu shadow="md" position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" size="lg" aria-label={t("shell.addToBoards")}>
                <PlusIcon size={17} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={() => setFolderDialog({ mode: "create" })}>{t("shell.newFolder")}</Menu.Item>
              <Menu.Item onClick={() => chrome?.openNewBoard()}>{t("dashboard.newBoard")}</Menu.Item>
            </Menu.Dropdown>
          </Menu>
          <button
            type="button"
            aria-label={expanded ? t("shell.collapseBoards") : t("shell.expandBoards")}
            aria-expanded={expanded}
            onClick={() => setCollapsed(expanded)}
            className="flex h-9 w-8 shrink-0 items-center justify-center rounded-md text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--app-primary)]"
          >
            <ChevronIcon expanded={expanded} />
          </button>
        </div>
        {ready && expanded ? (
          <BoardTree
            boards={boards}
            folders={foldersQuery.data ?? []}
            currentBoardId={currentBoardId}
            onNavigate={close}
            onNewBoard={(folderId) => chrome?.openNewBoard(folderId)}
            onFolderDialog={setFolderDialog}
          />
        ) : null}
        <NavLink href="/plans" icon="plans" label={t("shell.plans")} section="plans" current={section} onClick={close} />
        <NavLink href="/notepad" icon="notepad" label={t("shell.notepad")} section="notepad" current={section} onClick={close} />
        <NavLink href="/schedule" icon="schedule" label={t("shell.schedule")} section="schedule" current={section} onClick={close} />
      </nav>
      <div className="border-t border-[var(--app-border)] bg-[var(--app-surface-muted)]/45 px-3 py-3">
        {user ? (
          <button
            type="button"
            onClick={() => setAccountOpen(true)}
            aria-label={t("account.open", { name: user.display_name })}
            title={t("account.title")}
            className="mb-3 block w-full rounded-md px-1 py-1 text-left transition-colors hover:bg-[var(--app-surface-muted)]"
          >
            <p className="truncate text-sm font-medium text-[var(--app-text)]">{user.display_name}</p>
            <p className="truncate text-xs text-[var(--app-text-muted)]">{user.login_id}</p>
          </button>
        ) : null}
        <AccountSettingsModal opened={accountOpen} onClose={() => setAccountOpen(false)} />
        <FolderDialogs dialog={folderDialog} onClose={() => setFolderDialog(null)} />
        <div className="flex items-center justify-between gap-2">
          <Button variant="subtle" color="gray" onClick={() => void logout()}>
            {t("shell.logout")}
          </Button>
          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </div>
  );
}

function NavLink({
  href,
  icon,
  label,
  section,
  current,
  count,
  onClick,
}: {
  href: string;
  icon: NavIconName;
  label: string;
  section: AppSection;
  current: AppSection;
  count?: number;
  onClick: () => void;
}) {
  const active = section === current;
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={`mt-0.5 shrink-0 ${navItemClass(active)}`}
    >
      <NavIcon name={icon} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count ? (
        <span className="shrink-0 rounded-full bg-[var(--app-surface-muted)] px-2 py-px text-xs font-semibold text-[var(--app-text-muted)]">
          {count}
        </span>
      ) : null}
    </Link>
  );
}

function BoardTree({
  boards,
  folders,
  currentBoardId,
  onNavigate,
  onNewBoard,
  onFolderDialog,
}: {
  boards: BoardListItem[];
  folders: BoardFolder[];
  currentBoardId?: string;
  onNavigate: () => void;
  onNewBoard: (folderId: string) => void;
  onFolderDialog: (dialog: FolderDialog) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLAnchorElement | null>(null);
  const [collapsedFolders, setCollapsedFolders] = useState<string[]>([]);
  const [dragSource, setDragSource] = useState<BoardDragData | null>(null);
  const folderIds = useMemo(() => new Set(folders.map((folder) => folder.id)), [folders]);
  const { moveBoard } = useBoardFolderMutations();

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(COLLAPSED_FOLDERS_KEY) ?? "[]");
      if (Array.isArray(stored)) setCollapsedFolders(stored.filter((id) => typeof id === "string"));
    } catch {
      setCollapsedFolders([]);
    }
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollTop = savedBoardListScrollTop;
    const onScroll = () => {
      savedBoardListScrollTop = viewport.scrollTop;
    };
    viewport.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (viewport.scrollTop) savedBoardListScrollTop = viewport.scrollTop;
      viewport.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    const item = currentRef.current;
    const viewport = viewportRef.current;
    if (!item || !viewport) return;
    const itemRect = item.getBoundingClientRect();
    const viewRect = viewport.getBoundingClientRect();
    const offScreen = itemRect.top < viewRect.top || itemRect.bottom > viewRect.bottom;
    if (offScreen) item.scrollIntoView({ block: "nearest" });
  }, [currentBoardId]);

  function toggleFolder(id: string) {
    const next = collapsedFolders.includes(id)
      ? collapsedFolders.filter((item) => item !== id)
      : [...collapsedFolders, id];
    setCollapsedFolders(next);
    window.localStorage.setItem(COLLAPSED_FOLDERS_KEY, JSON.stringify(next));
  }

  const renderBoard = (board: BoardListItem) => {
    const current = board.id === currentBoardId;
    const folderId = board.folder_id && folderIds.has(board.folder_id) ? board.folder_id : null;
    return (
      <DraggableBoard
        key={board.id}
        boardId={board.id}
        folderId={folderId}
        disabled={!canMoveBoardToFolder(board) || !folders.length}
      >
        {(dragRef) => (
          <>
            <Link
              href={`/boards/${board.id}`}
              ref={(element: HTMLAnchorElement | null) => {
                dragRef(element);
                if (current) currentRef.current = element;
                else if (currentRef.current === element) currentRef.current = null;
              }}
              // The board is dragged with dnd-kit; the browser's own link dragging would compete with it.
              draggable={false}
              onClick={onNavigate}
              aria-current={current ? "page" : undefined}
              className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg py-1.5 pl-2 pr-7 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--app-primary)] ${
                current
                  ? "bg-[var(--app-primary-soft)] text-[var(--app-text)]"
                  : "text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)]"
              }`}
            >
              <span className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md text-white ${boardColorClass(board.color)}`}>
                <BoardGlyph name={board.icon_name} size={12} />
              </span>
              <span className="min-w-0 flex-1 truncate">{board.name}</span>
              {board.role === "member" ? (
                <span
                  className="shrink-0 text-[var(--app-text-muted)]"
                  title={board.owner_name ? t("shell.sharedBy", { name: board.owner_name }) : t("shell.sharedWithYou")}
                  aria-label={t("shell.sharedWithYou")}
                >
                  <SharedIcon />
                </span>
              ) : null}
            </Link>
            {board.role !== "member" && folders.length ? <BoardFolderMenu board={board} folders={folders} /> : null}
          </>
        )}
      </DraggableBoard>
    );
  };

  const ungrouped = boardsInFolder(boards, folderIds, null);
  // Dropping a board where it already is changes nothing, so that target is not highlighted.
  const isValidTarget = (folderId: string | null) => dragSource !== null && dragSource.folderId !== folderId;

  return (
    <div
      aria-label={t("shell.yourBoards")}
      className="mt-1 ml-3 max-h-[min(40vh,320px)] shrink-0 overflow-hidden border-l border-[var(--app-border)] pl-2"
    >
      <ScrollArea.Autosize mah="min(40vh, 320px)" type="auto" viewportRef={viewportRef}>
        <DragDropProvider
          sensors={BOARD_DRAG_SENSORS}
          onDragStart={(event) => setDragSource((event.operation.source?.data as BoardDragData | undefined) ?? null)}
          onDragEnd={(event) => {
            setDragSource(null);
            const move = folderMoveFromDrop(event.operation.source?.data, event.operation.target?.data, event.canceled);
            if (!move) return;
            moveBoard.mutate(move, { onError: (error) => notifyApiError(error, t("workspace.couldNotSave")) });
          }}
        >
          <div className="flex flex-col gap-0.5 py-1 pr-1">
            {folders.map((folder) => {
              const open = !collapsedFolders.includes(folder.id);
              const inside = boardsInFolder(boards, folderIds, folder.id);
              return (
                <FolderDropZone key={folder.id} folderId={folder.id} name={folder.name} valid={isValidTarget(folder.id)}>
                  <div className="group/folder flex items-center rounded-lg hover:bg-[var(--app-surface-muted)]">
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-label={t("shell.toggleFolder", { name: folder.name })}
                      onClick={() => toggleFolder(folder.id)}
                      className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg py-1.5 pl-1 text-left text-xs font-semibold text-[var(--app-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--app-primary)]"
                    >
                      <ChevronIcon expanded={open} size={13} />
                      <FolderIcon />
                      <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                    </button>
                    <div className="flex shrink-0 items-center opacity-100 sm:opacity-0 sm:focus-within:opacity-100 sm:group-hover/folder:opacity-100">
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="sm"
                        aria-label={t("shell.newBoardInFolder", { name: folder.name })}
                        onClick={() => onNewBoard(folder.id)}
                      >
                        <PlusIcon size={13} />
                      </ActionIcon>
                      <Menu shadow="md" position="bottom-end" withinPortal>
                        <Menu.Target>
                          <ActionIcon variant="subtle" color="gray" size="sm" aria-label={t("shell.folderMenu", { name: folder.name })}>
                            <DotsIcon size={14} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item onClick={() => onFolderDialog({ mode: "rename", folder })}>{t("shell.renameFolder")}</Menu.Item>
                          <Menu.Item color="red" onClick={() => onFolderDialog({ mode: "delete", folder })}>
                            {t("shell.deleteFolder")}
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </div>
                  </div>
                  {open ? (
                    <div className="ml-3 flex flex-col gap-0.5 pt-0.5">
                      {inside.map(renderBoard)}
                      {!inside.length ? (
                        <Text size="xs" c="dimmed" px="xs" py={3}>
                          {t("shell.emptyFolder")}
                        </Text>
                      ) : null}
                    </div>
                  ) : null}
                </FolderDropZone>
              );
            })}
            <FolderDropZone folderId={null} name={t("shell.noFolder")} valid={isValidTarget(null)}>
              {ungrouped.map(renderBoard)}
              {dragSource?.folderId ? (
                <Text
                  size="xs"
                  c="dimmed"
                  px="xs"
                  py={6}
                  className="rounded-lg border border-dashed border-[var(--app-border)] text-center"
                >
                  {t("shell.dropUngrouped")}
                </Text>
              ) : null}
            </FolderDropZone>
            {!boards.length && !folders.length ? (
              <Text size="xs" c="dimmed" px="xs">
                {t("shell.noBoards")}
              </Text>
            ) : null}
          </div>
        </DragDropProvider>
      </ScrollArea.Autosize>
    </div>
  );
}

/** A sidebar board row that can be dragged onto a folder; `children` gets the ref for the board link. */
function DraggableBoard({
  boardId,
  folderId,
  disabled,
  children,
}: {
  boardId: string;
  folderId: string | null;
  disabled: boolean;
  children: (ref: (element: Element | null) => void) => ReactNode;
}) {
  const data = useMemo<BoardDragData>(() => ({ boardId, folderId }), [boardId, folderId]);
  const { ref, isDragging } = useDraggable({ id: `sidebar-board:${boardId}`, type: SIDEBAR_BOARD_DRAG_TYPE, data, disabled });
  return (
    <div
      data-board-draggable={disabled ? undefined : "true"}
      className={`group/board relative flex items-center ${isDragging ? "opacity-70" : ""}`}
    >
      {children(ref)}
    </div>
  );
}

/** A folder, or with `folderId` null the ungrouped area, that sidebar boards can be dropped onto. */
function FolderDropZone({
  folderId,
  name,
  valid,
  children,
}: {
  folderId: string | null;
  name: string;
  valid: boolean;
  children: ReactNode;
}) {
  const data = useMemo<FolderDropData>(() => ({ folderId }), [folderId]);
  const { ref, isDropTarget } = useDroppable({
    id: folderDropId(folderId),
    type: "board-folder",
    accept: SIDEBAR_BOARD_DRAG_TYPE,
    data,
  });
  const highlighted = valid && isDropTarget;
  return (
    <div
      ref={ref}
      data-folder-drop={folderId ?? "none"}
      data-drop-target={highlighted ? "true" : undefined}
      title={highlighted ? t("shell.dropOnFolder", { name }) : undefined}
      className={`flex flex-col gap-0.5 rounded-lg transition-colors ${
        highlighted ? "bg-[var(--app-primary-soft)] outline outline-2 outline-[var(--app-primary)]" : ""
      }`}
    >
      {children}
    </div>
  );
}

function BoardFolderMenu({ board, folders }: { board: BoardListItem; folders: BoardFolder[] }) {
  const { moveBoard } = useBoardFolderMutations();
  const move = (folderId: string | null) =>
    moveBoard.mutate(
      { boardId: board.id, folderId },
      { onError: (error) => notifyApiError(error, t("workspace.couldNotSave")) },
    );
  return (
    <div className="absolute right-0.5 opacity-100 focus-within:opacity-100 sm:opacity-0 sm:group-hover/board:opacity-100">
      <Menu shadow="md" position="bottom-end" width={200} withinPortal>
        <Menu.Target>
          <ActionIcon variant="subtle" color="gray" size="sm" aria-label={t("shell.moveBoardToFolder", { name: board.name })}>
            <DotsIcon size={14} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>{t("shell.moveToFolder")}</Menu.Label>
          {folders.map((folder) => (
            <Menu.Item
              key={folder.id}
              disabled={board.folder_id === folder.id}
              rightSection={board.folder_id === folder.id ? "✓" : null}
              onClick={() => move(folder.id)}
            >
              {folder.name}
            </Menu.Item>
          ))}
          <Menu.Divider />
          <Menu.Item disabled={!board.folder_id} onClick={() => move(null)}>
            {t("shell.noFolder")}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </div>
  );
}

function FolderDialogs({ dialog, onClose }: { dialog: FolderDialog | null; onClose: () => void }) {
  const { create, rename, remove } = useBoardFolderMutations();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(dialog && dialog.mode === "rename" ? dialog.folder.name : "");
    setError(null);
  }, [dialog]);

  async function save() {
    const value = name.trim();
    if (!value || !dialog) return;
    try {
      if (dialog.mode === "create") await create.mutateAsync(value);
      if (dialog.mode === "rename") await rename.mutateAsync({ folderId: dialog.folder.id, name: value });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("workspace.couldNotSave"));
    }
  }

  async function confirmDelete() {
    if (!dialog || dialog.mode !== "delete") return;
    try {
      await remove.mutateAsync(dialog.folder.id);
      notifySuccess(t("status.deleted", { name: dialog.folder.name }));
      onClose();
    } catch (err) {
      notifyApiError(err, t("workspace.couldNotSave"));
    }
  }

  if (dialog?.mode === "delete") {
    return (
      <Modal opened onClose={onClose} title={t("shell.deleteFolderTitle", { name: dialog.folder.name })} radius="lg">
        <Text size="sm" c="dimmed">
          {t("shell.deleteFolderBody")}
        </Text>
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button color="red" loading={remove.isPending} onClick={() => void confirmDelete()}>
            {t("shell.deleteFolder")}
          </Button>
        </Group>
      </Modal>
    );
  }

  return (
    <Modal
      opened={Boolean(dialog)}
      onClose={onClose}
      title={dialog?.mode === "rename" ? t("shell.renameFolder") : t("shell.newFolder")}
      radius="lg"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <TextInput
          label={t("shell.folderName")}
          placeholder={t("shell.folderNamePlaceholder")}
          maxLength={80}
          value={name}
          error={error}
          data-autofocus
          onChange={(event) => {
            setName(event.currentTarget.value);
            setError(null);
          }}
        />
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={!name.trim()} loading={create.isPending || rename.isPending}>
            {t("common.save")}
          </Button>
        </Group>
      </form>
    </Modal>
  );
}

function navItemClass(active: boolean): string {
  return `flex min-w-0 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--app-primary)] ${
    active
      ? "bg-[var(--app-primary-soft)] text-[var(--app-primary)]"
      : "text-[var(--app-text-muted)] hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)]"
  }`;
}

function FolderIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden className="shrink-0">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2.500h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </svg>
  );
}

function SharedIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="8" r="3.5" stroke="currentColor" strokeWidth="2" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ expanded, size = 16 }: { expanded: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={`shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
    >
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
