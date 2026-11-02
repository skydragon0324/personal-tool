import { Button, Group, Modal, Text } from "@mantine/core";
import { t } from "@/i18n";

/** Asks before closing an editor with unsaved edits. */
export function DiscardChangesModal({
  opened,
  onKeepEditing,
  onDiscard,
}: {
  opened: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
}) {
  return (
    <Modal opened={opened} onClose={onKeepEditing} title={t("common.discardTitle")} radius="lg" zIndex={400}>
      <Text size="sm" c="dimmed">
        {t("common.discardBody")}
      </Text>
      <Group justify="flex-end" mt="md">
        <Button variant="default" onClick={onKeepEditing} data-autofocus>
          {t("common.keepEditing")}
        </Button>
        <Button color="red" onClick={onDiscard}>
          {t("common.discard")}
        </Button>
      </Group>
    </Modal>
  );
}
