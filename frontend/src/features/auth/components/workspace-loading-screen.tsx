"use client";

import { Loader, Text } from "@mantine/core";

export function WorkspaceLoadingScreen() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[var(--app-bg)]">
      <Loader color="teal" />
      <Text c="dimmed">Loading workspace...</Text>
    </div>
  );
}
