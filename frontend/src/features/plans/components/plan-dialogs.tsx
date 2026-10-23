import { Button, Group, Modal, Stack, Text, TextInput, Textarea } from "@mantine/core";
import { useEffect, useState } from "react";

import { DatePickerInput } from "@/lib/date-pickers";

import type { PlanDayCreate, PlanCreate } from "../types";
import { t } from "@/i18n";

export function PlanFormModal({
  opened,
  title,
  submitLabel,
  initial,
  submitting,
  onSubmit,
  onClose,
}: {
  opened: boolean;
  title: string;
  submitLabel: string;
  initial?: PlanCreate;
  submitting?: boolean;
  onSubmit: (payload: PlanCreate) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!opened) return;
    setName(initial?.name ?? "");
    setDescription(initial?.description ?? "");
  }, [initial?.description, initial?.name, opened]);

  const trimmed = name.trim();

  return (
    <Modal opened={opened} onClose={onClose} title={title} radius="lg">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (trimmed) onSubmit({ name: trimmed, description: description.trim() });
        }}
      >
        <Stack gap="sm">
          <TextInput
            label={t("plans.name")}
            placeholder={t("plans.namePlaceholder")}
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            maxLength={120}
            required
            data-autofocus
          />
          <Textarea
            label={t("plans.description")}
            placeholder={t("plans.optional")}
            value={description}
            onChange={(event) => setDescription(event.currentTarget.value)}
            autosize
            minRows={2}
            maxRows={5}
            maxLength={2000}
          />
          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={submitting} disabled={!trimmed}>
              {submitLabel}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

export function PlanDayModal({
  opened,
  title,
  submitLabel,
  initial,
  takenDays,
  submitting,
  onSubmit,
  onClose,
}: {
  opened: boolean;
  title: string;
  submitLabel: string;
  initial: PlanDayCreate;
  /** Dates that already exist in the plan (YYYY-MM-DD); they cannot be picked again. */
  takenDays: string[];
  submitting?: boolean;
  onSubmit: (payload: PlanDayCreate) => void;
  onClose: () => void;
}) {
  const [day, setDay] = useState<string | null>(initial.day);
  const [label, setLabel] = useState(initial.title ?? "");

  useEffect(() => {
    if (!opened) return;
    setDay(initial.day);
    setLabel(initial.title ?? "");
  }, [initial.day, initial.title, opened]);

  const taken = new Set(takenDays.filter((value) => value !== initial.day));
  const clash = day !== null && taken.has(day);

  return (
    <Modal opened={opened} onClose={onClose} title={title} radius="lg">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (day && !clash) onSubmit({ day, title: label.trim() });
        }}
      >
        <Stack gap="sm">
          <DatePickerInput
            label={t("plans.date")}
            value={day}
            onChange={setDay}
            valueFormat="dddd, MMMM D, YYYY"
            excludeDate={(value) => taken.has(value)}
            error={clash ? t("plans.dayTaken") : undefined}
            required
          />
          <TextInput
            label={t("plans.label")}
            placeholder={t("plans.labelPlaceholder")}
            value={label}
            onChange={(event) => setLabel(event.currentTarget.value)}
            maxLength={120}
          />
          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={submitting} disabled={!day || clash}>
              {submitLabel}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

export function ConfirmDeleteDialog({
  title,
  message,
  opened,
  submitting,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  opened: boolean;
  submitting?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal opened={opened} onClose={onClose} title={title} radius="lg">
      <Text size="sm" c="dimmed">
        {message}
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
