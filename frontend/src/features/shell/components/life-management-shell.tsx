import { screenHeight } from "@/lib/viewport";

import { NotificationBridge } from "@/features/notifications/components/notification-bridge";
import { GlobalSearchProvider } from "@/features/search/components/global-search-provider";

import { SIDEBAR_ID, SIDEBAR_RAIL_WIDTH, SIDEBAR_WIDTH } from "../utils/sidebar-preference";
import { AppSidebar } from "./app-sidebar";
import { CollapsedSidebarRail } from "./collapsed-sidebar-rail";
import { MobileSidebarDrawer } from "./mobile-sidebar-drawer";
import { WorkspaceChromeProvider, useWorkspaceChrome } from "./workspace-chrome";

export function LifeManagementShell({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceChromeProvider>
      <NotificationBridge />
      <GlobalSearchProvider>
        <ShellFrame>{children}</ShellFrame>
      </GlobalSearchProvider>
    </WorkspaceChromeProvider>
  );
}

/**
 * Large screens: the sidebar sits beside the page (never over it) and is either the full sidebar
 * or the icon rail; the page takes the rest of the width. Small screens: no rail, the full sidebar
 * opens as a drawer from the page header's menu button.
 */
function ShellFrame({ children }: { children: React.ReactNode }) {
  const chrome = useWorkspaceChrome();
  const desktop = chrome?.isDesktop ?? false;
  const collapsed = chrome?.sidebarCollapsed ?? false;
  return (
    <div className="flex overflow-hidden" style={{ height: screenHeight(100), background: "var(--app-bg)" }}>
      {desktop ? (
        <div
          id={SIDEBAR_ID}
          data-sidebar-state={collapsed ? "collapsed" : "expanded"}
          style={{ width: collapsed ? SIDEBAR_RAIL_WIDTH : SIDEBAR_WIDTH }}
          className="relative h-full shrink-0 overflow-hidden transition-[width] duration-200 ease-out motion-reduce:transition-none"
        >
          {collapsed ? (
            <CollapsedSidebarRail />
          ) : (
            // A fixed inner width: the content is clipped while the width animates, never reflowed.
            <div className="h-full" style={{ width: SIDEBAR_WIDTH }}>
              <AppSidebar />
            </div>
          )}
        </div>
      ) : (
        <MobileSidebarDrawer>
          <AppSidebar />
        </MobileSidebarDrawer>
      )}
      <main className="min-h-0 min-w-0 flex-1 overflow-hidden" style={{ height: screenHeight(100), background: "var(--app-bg)" }}>
        {children}
      </main>
    </div>
  );
}
