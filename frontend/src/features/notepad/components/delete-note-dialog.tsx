"use client";

import { Button, Group, Modal, Text } from "@mantine/core";

interface DeleteNoteDialogProps {
  noteTitle: string | null;
  submitting?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function DeleteNoteDialog({
  noteTitle,
  submitting,
  onConfirm,
  onClose,
}: DeleteNoteDialogProps) {
  return (
    <Modal opened={noteTitle !== null} onClose={onClose} title="Delete this note?" radius="lg">
      <Text size="sm" c="dimmed">
        “{noteTitle}” will be permanently removed.
      </Text>
      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={onClose}>
          Cancel
        </Button>
        <Button color="red" onClick={onConfirm} loading={submitting}>
          Delete
        </Button>
      </Group>
    </Modal>
  );
}
