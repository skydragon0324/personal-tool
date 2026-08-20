"use client";

import { Button, Text } from "@mantine/core";

import { BOARD_CONTENT_GUTTER } from "../utils/board-layout";

export function NoStatusesState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className={`${BOARD_CONTENT_GUTTER} bg-[var(--app-bg)] pb-8`}>
      <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-6 py-16 text-center shadow-sm">
        <h2 className="font-display text-2xl text-[var(--app-text)]">No statuses yet</h2>
        <Text c="dimmed" className="mx-auto mt-2 max-w-md">
          Create a status to start adding tasks.
        </Text>
        <Button className="mt-6" onClick={onCreate}>
          Create status
        </Button>
      </div>
    </div>
  );
}
