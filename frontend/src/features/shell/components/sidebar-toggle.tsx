import { Tooltip } from "@mantine/core";
import { useEffect, useRef } from "react";

import { t } from "@/i18n";

import { SIDEBAR_ID } from "../utils/sidebar-preference";
import { NavIcon } from "./nav-icons";
import { useWorkspaceChrome } from "./workspace-chrome";

// Collapsing swaps the full sidebar for the rail (and back), which replaces this button. The new
// one takes focus so keyboard users stay on the toggle.
let focusNextToggle = false;

/**
 * Collapses or expands the large-screen sidebar; inside the small-screen drawer it closes the
 * drawer. Always a real button that names the sidebar it controls.
 */
export function SidebarToggle() {
  const chrome = useWorkspaceChrome();
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!focusNextToggle) return;
    focusNextToggle = false;
    ref.current?.focus();
  }, []);

  if (!chrome) return null;
  const desktop = chrome.isDesktop;
  const expanded = desktop ? !chrome.sidebarCollapsed : chrome.mobileSidebarOpened;
  const label = desktop
    ? chrome.sidebarCollapsed
      ? t("shell.expandSidebar")
      : t("shell.collapseSidebar")
    : expanded
      ? t("shell.closeNavigation")
      : t("shell.openNavigation");

  return (
    <Tooltip label={label} position="right" withArrow openDelay={300} events={{ hover: true, focus: true, touch: false }}>
      <button
        ref={ref}
        type="button"
        data-sidebar-toggle
        aria-label={label}
        aria-expanded={expanded}
        aria-controls={SIDEBAR_ID}
        onClick={() => {
          if (desktop) {
            focusNextToggle = true;
            chrome.toggleSidebarCollapsed();
          } else {
            chrome.toggleSidebar();
          }
        }}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--app-primary)]"
      >
        <NavIcon name="sidebar" />
      </button>
    </Tooltip>
  );
}
