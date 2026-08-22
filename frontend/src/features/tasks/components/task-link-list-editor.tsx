"use client";

import { Button, Group, Paper, SimpleGrid, Stack, Text, TextInput, Title } from "@mantine/core";

import type { RecurrenceSeriesLinkInput } from "@/features/recurrence/types";

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
        <Title order={5}>Reference links</Title>
        <Button
          size="xs"
          variant="light"
          type="button"
          disabled={disabled}
          onClick={() =>
            onChange([...links, { label: "", url: "https://", position: links.length }])
          }
        >
          Add link
        </Button>
      </Group>
      {links.map((link, index) => (
        <Paper key={link.id ?? `link-${index}`} withBorder p="sm" radius="md">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput
              label="Name"
              value={link.label}
              error={errors?.[`link-${index}`]}
              disabled={disabled}
              onChange={(event) => {
                const label = event.currentTarget.value;
                onChange(links.map((item, i) => (i === index ? { ...item, label } : item)));
              }}
            />
            <TextInput
              label="URL"
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
              Remove
            </Button>
          </Group>
        </Paper>
      ))}
      {links.length === 0 ? (
        <Text size="sm" c="dimmed">
          No reference links.
        </Text>
      ) : null}
    </Stack>
  );
}
