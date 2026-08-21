"use client";

import { Button, Radio, Stack, Text } from "@mantine/core";

import type { DeleteScope, EditScope } from "@/features/board/types";

export function RecurrenceScopeDialog({
  open,
  mode,
  taskTitle,
  completed = false,
  submitting,
  onClose,
  onConfirm,
}: {
  open: boolean;
  mode: "edit" | "delete";
  taskTitle: string;
  completed?: boolean;
  submitting?: boolean;
  onClose: () => void;
  onConfirm: (scope: EditScope | DeleteScope, confirmCompleted?: boolean) => void;
}) {
  if (!open) return null;
  const isDelete = mode === "delete";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="alertdialog"
      aria-modal="true"
      aria-label={isDelete ? "Delete repeating task" : "Edit repeating task"}
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <form
        className="relative z-10 w-full max-w-md rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-xl"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const scope = String(data.get("scope") || "this") as EditScope;
          onConfirm(scope, isDelete && completed);
        }}
      >
        <h2 className="font-display text-xl text-[var(--app-text)]">
          {isDelete ? "Delete a repeating task" : "Save a repeating task"}
        </h2>
        <Text size="sm" c="dimmed" mt="sm">
          This is a repeating task.
        </Text>
        {isDelete && completed ? (
          <Text size="sm" mt="sm">
            This completed task will be permanently removed. Other repeats are kept.
          </Text>
        ) : null}
        <Radio.Group name="scope" defaultValue="this" mt="md">
          <Stack gap="xs">
            <Radio value="this" label="This task only" />
            {!completed ? (
              <>
                <Radio value="this_and_future" label="This and following tasks" />
                <Radio value="series" label="All tasks in the series" />
              </>
            ) : null}
          </Stack>
        </Radio.Group>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" color={isDelete ? "red" : undefined} loading={submitting}>
            {isDelete ? "Delete" : "Save"}
          </Button>
        </div>
      </form>
    </div>
  );
}
