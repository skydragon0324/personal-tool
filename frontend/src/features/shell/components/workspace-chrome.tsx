import { Burger, useMantineTheme } from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { usePathname } from "@/lib/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";

import { ManageBoardsModal } from "@/features/board/components/manage-boards-modal";
import { NewBoardModal } from "@/features/board/components/new-board-modal";

import { useSidebarPreference } from "../hooks/use-sidebar-preference";
import { boardIdFromPath } from "../utils/navigation";
import { SIDEBAR_ID } from "../utils/sidebar-preference";
import { t } from "@/i18n";

interface WorkspaceChromeValue {
  /** Large screens (Mantine's `sm` breakpoint and up) show the docked sidebar; smaller ones a drawer. */
  isDesktop: boolean;
  /** Large screens: the sidebar is reduced to its icon rail. Saved in this browser. */
  sidebarCollapsed: boolean;
  toggleSidebarCollapsed: () => void;
  /** Small screens: the navigation drawer is open. Never saved. */
  mobileSidebarOpened: boolean;
  /** Drawer controls (names kept from before the rail existed). Closing returns focus to the menu button. */
  openSidebar: () => void;
  toggleSidebar: () => void;
  closeSidebar: () => void;
  sidebarOpened: boolean;
  /** The page's menu button, which gets focus back when the drawer closes. */
  menuButtonRef: MutableRefObject<HTMLButtonElement | null>;
  /** Opens the new-board dialog, optionally creating the board inside a folder. */
  openNewBoard: (folderId?: string) => void;
  openManageBoards: () => void;
}

const WorkspaceChromeContext = createContext<WorkspaceChromeValue | null>(null);

export function useWorkspaceChrome(): WorkspaceChromeValue | null {
  return useContext(WorkspaceChromeContext);
}

/** Matches Mantine's `sm` breakpoint, the one the menu button (`hiddenFrom="sm"`) already uses. */
export function useIsDesktop(): boolean {
  const theme = useMantineTheme();
  return useMediaQuery(`(min-width: ${theme.breakpoints.sm})`, undefined, { getInitialValueInEffect: false }) ?? false;
}

export function WorkspaceChromeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const boardId = boardIdFromPath(pathname);
  const isDesktop = useIsDesktop();
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarPreference();
  const [mobileSidebarOpened, mobile] = useDisclosure(false);
  const [newOpened, newBoard] = useDisclosure(false);
  const [manageOpened, manage] = useDisclosure(false);
  const [newBoardFolderId, setNewBoardFolderId] = useState<string | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const openedRef = useRef(mobileSidebarOpened);
  openedRef.current = mobileSidebarOpened;

  // Growing past the breakpoint closes the drawer (and with it the backdrop and scroll lock). The
  // saved large-screen preference is left as it is in both directions.
  useEffect(() => {
    if (isDesktop) mobile.close();
  }, [isDesktop, mobile]);

  const closeSidebar = useCallback(() => {
    if (!openedRef.current) return;
    mobile.close();
    // After the drawer has gone, so its focus trap does not take focus back.
    window.setTimeout(() => menuButtonRef.current?.focus(), 0);
  }, [mobile]);

  const toggleSidebar = useCallback(() => {
    if (openedRef.current) closeSidebar();
    else mobile.open();
  }, [closeSidebar, mobile]);

  const toggleSidebarCollapsed = useCallback(
    () => setSidebarCollapsed(!sidebarCollapsed),
    [setSidebarCollapsed, sidebarCollapsed],
  );

  const openNewBoard = useCallback(
    (folderId?: string) => {
      setNewBoardFolderId(folderId ?? null);
      newBoard.open();
    },
    [newBoard],
  );

  const chrome = useMemo<WorkspaceChromeValue>(
    () => ({
      isDesktop,
      sidebarCollapsed,
      toggleSidebarCollapsed,
      mobileSidebarOpened,
      openSidebar: mobile.open,
      toggleSidebar,
      closeSidebar,
      sidebarOpened: mobileSidebarOpened,
      menuButtonRef,
      openNewBoard,
      openManageBoards: manage.open,
    }),
    [
      isDesktop,
      sidebarCollapsed,
      toggleSidebarCollapsed,
      mobileSidebarOpened,
      mobile.open,
      toggleSidebar,
      closeSidebar,
      openNewBoard,
      manage.open,
    ],
  );

  return (
    <WorkspaceChromeContext.Provider value={chrome}>
      {children}
      <NewBoardModal opened={newOpened} onClose={newBoard.close} folderId={newBoardFolderId} />
      <ManageBoardsModal
        opened={manageOpened}
        onClose={manage.close}
        currentBoardId={boardId}
      />
    </WorkspaceChromeContext.Provider>
  );
}

/** The page header's menu button. Only on small screens, where it opens the navigation drawer. */
export function MobileSidebarButton() {
  const chrome = useWorkspaceChrome();
  if (!chrome) return null;
  const opened = chrome.mobileSidebarOpened;
  return (
    <Burger
      ref={(element: HTMLButtonElement | null) => {
        if (element) chrome.menuButtonRef.current = element;
        else if (chrome.menuButtonRef.current && !chrome.menuButtonRef.current.isConnected) chrome.menuButtonRef.current = null;
      }}
      opened={opened}
      onClick={chrome.toggleSidebar}
      hiddenFrom="sm"
      size="sm"
      aria-label={opened ? t("shell.closeNavigation") : t("shell.openNavigation")}
      aria-expanded={opened}
      aria-controls={SIDEBAR_ID}
      className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--app-primary)]"
    />
  );
}
