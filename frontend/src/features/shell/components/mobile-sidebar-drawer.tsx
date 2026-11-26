import { Drawer } from "@mantine/core";
import { useReducedMotion } from "@mantine/hooks";
import type { ReactNode } from "react";

import { t } from "@/i18n";

import { SIDEBAR_ID, SIDEBAR_WIDTH } from "../utils/sidebar-preference";
import { useWorkspaceChrome } from "./workspace-chrome";

/**
 * The full sidebar as an overlay on small screens. Mantine's drawer is a modal dialog: it traps
 * focus, closes on Escape or a backdrop click, and locks page scrolling while open. Focus goes
 * back to the page's menu button when it closes (see `closeSidebar`).
 */
export function MobileSidebarDrawer({ children }: { children: ReactNode }) {
  const chrome = useWorkspaceChrome();
  const reduceMotion = useReducedMotion();
  if (!chrome) return null;
  return (
    <Drawer.Root
      opened={chrome.mobileSidebarOpened}
      onClose={chrome.closeSidebar}
      position="left"
      size={SIDEBAR_WIDTH}
      returnFocus={false}
      trapFocus
      lockScroll
      closeOnEscape
      closeOnClickOutside
      transitionProps={{ duration: reduceMotion ? 0 : 200 }}
    >
      <Drawer.Overlay backgroundOpacity={0.45} data-sidebar-backdrop />
      <Drawer.Content aria-label={t("shell.navigation")} data-sidebar-drawer>
        <Drawer.Body p={0} h="100%">
          <div id={SIDEBAR_ID} className="h-full">
            {children}
          </div>
        </Drawer.Body>
      </Drawer.Content>
    </Drawer.Root>
  );
}
