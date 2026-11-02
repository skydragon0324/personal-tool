import { Button, Group, Modal, Text } from "@mantine/core";
import { t } from "@/i18n";

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
      title={t("recurring.pauseTitle")}
      radius="lg"
    >
      <Text size="sm">
        {t("recurring.pauseBody")}
      </Text>
      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={onClose}>
          {t("common.cancel")}
        </Button>
        <Button color="red" onClick={onConfirm} loading={submitting}>
          {t("recurring.pause")}
        </Button>
      </Group>
    </Modal>
  );
}
