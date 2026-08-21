"use client";

import { Button, Group, Modal, Text } from "@mantine/core";

export function PauseRecurrenceDialog({
  title,
  submitting,
  onConfirm,
  onClose,
}: {
  title: string | null;
  submitting?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      opened={title !== null}
      onClose={onClose}
      title="Pause recurring task?"
      radius="lg"
    >
      <Text size="sm">
        Future occurrences will stop generating. Existing tasks and completed history will stay.
      </Text>
      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={onClose}>
          Cancel
        </Button>
        <Button color="red" onClick={onConfirm} loading={submitting}>
          Pause
        </Button>
      </Group>
    </Modal>
  );
}
