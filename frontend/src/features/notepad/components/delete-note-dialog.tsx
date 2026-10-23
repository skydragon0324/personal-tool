import { Button, Group, Modal, Text } from "@mantine/core";
import { t } from "@/i18n";

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
    <Modal opened={noteTitle !== null} onClose={onClose} title={t("notes.deleteTitle")} radius="lg">
      <Text size="sm" c="dimmed">
        {t("notes.willBeRemoved", { title: noteTitle ?? "" })}
      </Text>
      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button color="red" onClick={onConfirm} loading={submitting}>
          {t("common.delete")}
        </Button>
      </Group>
    </Modal>
  );
}
