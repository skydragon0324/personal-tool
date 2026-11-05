import { AppShell } from "@mantine/core";

import { screenHeight } from "@/lib/viewport";

import { NotificationBridge } from "@/features/notifications/components/notification-bridge";

import { AppSidebar } from "./app-sidebar";
import { WorkspaceChromeProvider, useWorkspaceChrome } from "./workspace-chrome";

export function LifeManagementShell({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceChromeProvider>
      <NotificationBridge />
      <ShellFrame>{children}</ShellFrame>
    </WorkspaceChromeProvider>
  );
}

function ShellFrame({ children }: { children: React.ReactNode }) {
  const chrome = useWorkspaceChrome();
  return (
    <AppShell
      padding={0}
      styles={{
        root: { height: screenHeight(100), minHeight: screenHeight(100), background: "var(--app-bg)" },
        main: {
          minHeight: 0,
          minWidth: 0,
          height: screenHeight(100),
          overflow: "auto",
          background: "var(--app-bg)",
        },
      }}
      navbar={{
        width: 272,
        breakpoint: "sm",
        collapsed: { mobile: !chrome?.sidebarOpened },
      }}
    >
      <AppShell.Navbar p={0}>
        <AppSidebar />
      </AppShell.Navbar>
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
