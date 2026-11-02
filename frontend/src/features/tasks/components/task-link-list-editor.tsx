import { Button, Group, Paper, SimpleGrid, Stack, Text, TextInput, Title } from "@mantine/core";

import type { RecurrenceSeriesLinkInput } from "@/features/recurrence/types";
import { t } from "@/i18n";

export function TaskLinkListEditor({
  links,
  onChange,
  disabled,
  errors,
}: {
  links: RecurrenceSeriesLinkInput[];
  onChange: (links: RecurrenceSeriesLinkInput[]) => void;
  disabled?: boolean;
  errors?: Record<string, string>;
}) {
  return (
    <Stack gap="sm">
      <Group justify="space-between">
        <Title order={5}>{t("taskForm.referenceLinks")}</Title>
        <Button
          size="xs"
          variant="light"
          type="button"
          disabled={disabled}
          onClick={() =>
            onChange([...links, { label: "", url: "https://", position: links.length }])
          }
        >
          {t("taskForm.addLink")}
        </Button>
      </Group>
      {links.map((link, index) => (
        <Paper key={link.id ?? `link-${index}`} withBorder p="sm" radius="md">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput
              label={t("taskForm.linkName")}
              value={link.label}
              error={errors?.[`link-${index}`]}
              disabled={disabled}
              onChange={(event) => {
                const label = event.currentTarget.value;
                onChange(links.map((item, i) => (i === index ? { ...item, label } : item)));
              }}
            />
            <TextInput
              label={t("taskForm.linkUrl")}
              value={link.url}
              error={errors?.[`link-${index}`] ? " " : undefined}
              disabled={disabled}
              onChange={(event) => {
                const url = event.currentTarget.value;
                onChange(links.map((item, i) => (i === index ? { ...item, url } : item)));
              }}
            />
          </SimpleGrid>
          <Group justify="flex-end" mt="xs">
            <Button
              size="xs"
              color="red"
              variant="subtle"
              type="button"
              disabled={disabled}
              onClick={() => onChange(links.filter((_, i) => i !== index))}
            >
              {t("taskForm.remove")}
            </Button>
          </Group>
        </Paper>
      ))}
      {links.length === 0 ? (
        <Text size="sm" c="dimmed">
          {t("taskForm.noReferenceLinks")}
        </Text>
      ) : null}
    </Stack>
  );
}
