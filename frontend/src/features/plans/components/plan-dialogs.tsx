"use client";

import { Button, Group, Modal, Stack, Text, TextInput, Textarea } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useEffect, useState } from "react";

import type { PlanDayCreate, PlanCreate } from "../types";

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
            label="Name"
            placeholder="e.g. Learning Plan"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            maxLength={120}
            required
            data-autofocus
          />
          <Textarea
            label="Description"
            placeholder="Optional"
            value={description}
            onChange={(event) => setDescription(event.currentTarget.value)}
            autosize
            minRows={2}
            maxRows={5}
            maxLength={2000}
          />
          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={onClose}>
              Cancel
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
            label="Date"
            value={day}
            onChange={setDay}
            valueFormat="dddd, MMMM D, YYYY"
            excludeDate={(value) => taken.has(value)}
            error={clash ? "This plan already has that day" : undefined}
            required
          />
          <TextInput
            label="Label"
            placeholder="Optional, e.g. Rest day"
            value={label}
            onChange={(event) => setLabel(event.currentTarget.value)}
            maxLength={120}
          />
          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={onClose}>
              Cancel
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
          Cancel
        </Button>
        <Button color="red" onClick={onConfirm} loading={submitting}>
          Delete
        </Button>
      </Group>
    </Modal>
  );
}
