"use client";

import { Button, Loader, Text } from "@mantine/core";

export function WorkspaceLoadingScreen({ onRetry }: { onRetry?: () => void } = {}) {
  if (onRetry) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[var(--app-bg)]">
        <Text c="dimmed">Could not reach the server.</Text>
        <Button variant="light" color="teal" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[var(--app-bg)]">
      <Loader color="teal" />
      <Text c="dimmed">Loading workspace...</Text>
    </div>
  );
}
