"use client";

import { Burger } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { usePathname } from "next/navigation";
import { createContext, useContext, useMemo } from "react";

import { ManageBoardsModal } from "@/features/board/components/manage-boards-modal";
import { NewBoardModal } from "@/features/board/components/new-board-modal";

import { boardIdFromPath } from "../utils/navigation";

interface WorkspaceChromeValue {
  openSidebar: () => void;
  toggleSidebar: () => void;
  closeSidebar: () => void;
  sidebarOpened: boolean;
  openNewBoard: () => void;
  openManageBoards: () => void;
}

const WorkspaceChromeContext = createContext<WorkspaceChromeValue | null>(null);

export function useWorkspaceChrome(): WorkspaceChromeValue | null {
  return useContext(WorkspaceChromeContext);
}

export function WorkspaceChromeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const boardId = boardIdFromPath(pathname);
  const [mobileOpened, mobile] = useDisclosure(false);
  const [newOpened, newBoard] = useDisclosure(false);
  const [manageOpened, manage] = useDisclosure(false);

  const chrome = useMemo(
    () => ({
      openSidebar: mobile.open,
      toggleSidebar: mobile.toggle,
      closeSidebar: mobile.close,
      sidebarOpened: mobileOpened,
      openNewBoard: newBoard.open,
      openManageBoards: manage.open,
    }),
    [mobile.open, mobile.toggle, mobile.close, mobileOpened, newBoard.open, manage.open],
  );

  return (
    <WorkspaceChromeContext.Provider value={chrome}>
      {children}
      <NewBoardModal opened={newOpened} onClose={newBoard.close} />
      <ManageBoardsModal
        opened={manageOpened}
        onClose={manage.close}
        currentBoardId={boardId}
      />
    </WorkspaceChromeContext.Provider>
  );
}

export function MobileSidebarButton() {
  const chrome = useWorkspaceChrome();
  if (!chrome) return null;
  return (
    <Burger
      opened={chrome.sidebarOpened}
      onClick={chrome.toggleSidebar}
      hiddenFrom="sm"
      size="sm"
      aria-label={chrome.sidebarOpened ? "Close navigation" : "Open navigation"}
    />
  );
}
