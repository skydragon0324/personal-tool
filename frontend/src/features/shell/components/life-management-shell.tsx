"use client";

import { AppShell } from "@mantine/core";

import { AppSidebar } from "./app-sidebar";
import { WorkspaceChromeProvider, useWorkspaceChrome } from "./workspace-chrome";

export function LifeManagementShell({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceChromeProvider>
      <ShellFrame>{children}</ShellFrame>
    </WorkspaceChromeProvider>
  );
}

function ShellFrame({ children }: { children: React.ReactNode }) {
  const chrome = useWorkspaceChrome();
  return (
    <AppShell
      padding={0}
      className="h-dvh"
      styles={{
        root: { height: "100dvh", minHeight: "100dvh", background: "var(--app-bg)" },
        main: {
          minHeight: 0,
          minWidth: 0,
          height: "100dvh",
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
