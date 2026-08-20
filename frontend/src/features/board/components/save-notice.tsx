"use client";

import { Alert, Button } from "@mantine/core";

interface SaveNoticeProps {
  message: string;
  outOfRange: boolean;
  hiddenByFilters: boolean;
  onViewTask?: () => void;
  onDismiss: () => void;
}

export function SaveNotice({
  message,
  outOfRange,
  hiddenByFilters,
  onViewTask,
  onDismiss,
}: SaveNoticeProps) {
  return (
    <Alert
      color="teal"
      variant="light"
      withCloseButton
      onClose={onDismiss}
      title="Saved"
      className="mx-auto mt-4 max-w-[1400px] px-4 sm:px-6"
    >
      <p>{message}</p>
      {outOfRange ? (
        <p className="mt-1 text-sm">This task is outside the current date range, so it is hidden.</p>
      ) : null}
      {hiddenByFilters ? (
        <p className="mt-1 text-sm">
          Category, priority, or search filters may still hide this task.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {outOfRange && onViewTask ? (
          <Button size="xs" onClick={onViewTask}>
            View task
          </Button>
        ) : null}
      </div>
    </Alert>
  );
}
