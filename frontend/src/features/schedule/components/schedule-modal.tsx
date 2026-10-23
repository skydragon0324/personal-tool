import {
  Button,
  Checkbox,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { useEffect, useState } from "react";

import { STATUS_COLOR_OPTIONS } from "@/features/board/utils/status-colors";

import type { ScheduleEntry, ScheduleEntryCreate, ScheduleKind, SchedulePriority } from "../types";
import { parseTimeToMinutes, weekdayLabels } from "../utils/schedule-time";
import { t } from "@/i18n";

interface Draft {
  title: string;
  kind: ScheduleKind;
  weekdays: number[];
  start_time: string;
  end_time: string;
  priority: SchedulePriority | "none";
  color: string;
  notes: string;
}

const EMPTY: Draft = {
  title: "",
  kind: "routine",
  weekdays: [],
  start_time: "09:00:00",
  end_time: "09:30:00",
  priority: "none",
  color: "teal",
  notes: "",
};

export interface SchedulePrefill {
  weekday: number;
  start_time: string;
  end_time: string;
}

interface ScheduleModalProps {
  opened: boolean;
  entry: ScheduleEntry | null;
  prefill?: SchedulePrefill | null;
  submitting?: boolean;
  onClose: () => void;
  onCreate: (payload: ScheduleEntryCreate) => Promise<void>;
  onUpdate: (entryId: string, payload: ScheduleEntryCreate) => Promise<void>;
  onDelete?: (entry: ScheduleEntry) => void;
  weekStart: string;
}

function toInputTime(value: string): string {
  return value.slice(0, 5);
}

function fromInputTime(value: string): string {
  return value.length === 5 ? `${value}:00` : value;
}

export function ScheduleModal({
  opened,
  entry,
  prefill,
  submitting,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
  weekStart,
}: ScheduleModalProps) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!opened) return;
    setError(null);
    if (entry) {
      setDraft({
        title: entry.title,
        kind: entry.kind,
        weekdays: entry.weekdays,
        start_time: entry.start_time,
        end_time: entry.end_time,
        priority: entry.priority ?? "none",
        color: entry.color,
        notes: entry.notes,
      });
      return;
    }
    setDraft({
      ...EMPTY,
      weekdays: prefill ? [prefill.weekday] : [0],
      start_time: prefill?.start_time ?? EMPTY.start_time,
      end_time: prefill?.end_time ?? EMPTY.end_time,
    });
  }, [entry, opened, prefill]);

  function toggleDay(day: number) {
    setDraft((current) => {
      const next = current.weekdays.includes(day)
        ? current.weekdays.filter((item) => item !== day)
        : [...current.weekdays, day];
      return { ...current, weekdays: next.sort((a, b) => a - b) };
    });
  }

  function applyQuick(days: number[]) {
    setDraft((current) => ({ ...current, weekdays: days }));
  }

  async function handleSave() {
    const title = draft.title.trim();
    if (!title) {
      setError(t("schedule.titleRequired"));
      return;
    }
    if (!draft.weekdays.length) {
      setError(t("schedule.selectDay"));
      return;
    }
    if (parseTimeToMinutes(draft.end_time) <= parseTimeToMinutes(draft.start_time)) {
      setError(t("schedule.endAfterStart"));
      return;
    }
    const payload: ScheduleEntryCreate = {
      title,
      kind: draft.kind,
      weekdays: draft.weekdays,
      week_start: draft.kind === "this_week" ? weekStart : null,
      start_time: draft.start_time,
      end_time: draft.end_time,
      priority: draft.priority === "none" ? null : draft.priority,
      color: draft.color,
      notes: draft.notes,
    };
    if (entry) await onUpdate(entry.id, payload);
    else await onCreate(payload);
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={entry ? t("schedule.editTitle") : t("schedule.newTitle")}
      radius="lg"
      size="lg"
    >
      <Stack gap="md">
        <TextInput
          label={t("schedule.title")}
          required
          value={draft.title}
          onChange={(event) => {
            const title = event.currentTarget.value;
            setDraft((current) => ({ ...current, title }));
          }}
        />
        <Select
          label={t("schedule.type")}
          data={[
            { value: "routine", label: t("schedule.routine") },
            { value: "this_week", label: t("schedule.thisWeekOnly") },
          ]}
          value={draft.kind}
          allowDeselect={false}
          onChange={(value) =>
            setDraft((current) => ({ ...current, kind: (value as ScheduleKind) || "routine" }))
          }
        />
        <div>
          <Text size="sm" fw={500} mb={6}>
            {draft.kind === "routine" ? t("schedule.repeatDays") : t("schedule.day")}
          </Text>
          {draft.kind === "routine" ? (
            <Group gap="xs" mb="xs">
              <Button size="xs" variant="light" onClick={() => applyQuick([0, 1, 2, 3, 4, 5, 6])}>
                {t("schedule.everyDay")}
              </Button>
              <Button size="xs" variant="light" onClick={() => applyQuick([0, 1, 2, 3, 4])}>
                {t("schedule.weekdays")}
              </Button>
              <Button size="xs" variant="light" onClick={() => applyQuick([5, 6])}>
                {t("schedule.weekend")}
              </Button>
            </Group>
          ) : null}
          <Group gap="xs">
            {weekdayLabels().map((label, index) => (
              <Checkbox
                key={label}
                label={label}
                checked={draft.weekdays.includes(index)}
                onChange={() => toggleDay(index)}
              />
            ))}
          </Group>
        </div>
        <Group grow>
          <TextInput
            type="time"
            label={t("schedule.startTime")}
            value={toInputTime(draft.start_time)}
            onChange={(event) => {
              const start_time = fromInputTime(event.currentTarget.value);
              setDraft((current) => ({ ...current, start_time }));
            }}
          />
          <TextInput
            type="time"
            label={t("schedule.endTime")}
            value={toInputTime(draft.end_time)}
            onChange={(event) => {
              const end_time = fromInputTime(event.currentTarget.value);
              setDraft((current) => ({ ...current, end_time }));
            }}
          />
        </Group>
        <Group grow>
          <Select
            label={t("schedule.priority")}
            data={[
              { value: "none", label: t("common.none") },
              { value: "low", label: t("task.priorityLow") },
              { value: "medium", label: t("task.priorityMedium") },
              { value: "high", label: t("task.priorityHigh") },
            ]}
            value={draft.priority}
            allowDeselect={false}
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                priority: (value as SchedulePriority | "none") || "none",
              }))
            }
          />
          <Select
            label={t("schedule.color")}
            data={STATUS_COLOR_OPTIONS.map((item) => ({
              value: item.value,
              label: item.label[0].toUpperCase() + item.label.slice(1),
            }))}
            value={draft.color}
            allowDeselect={false}
            onChange={(value) => setDraft((current) => ({ ...current, color: value || "teal" }))}
          />
        </Group>
        <Textarea
          label={t("schedule.notes")}
          minRows={3}
          autosize
          value={draft.notes}
          onChange={(event) => {
            const notes = event.currentTarget.value;
            setDraft((current) => ({ ...current, notes }));
          }}
        />
        {error ? (
          <Text size="sm" c="red">
            {error}
          </Text>
        ) : null}
        <Group justify="space-between">
          {entry && onDelete ? (
            <Button color="red" variant="light" onClick={() => onDelete(entry)}>
              {t("common.delete")}
            </Button>
          ) : (
            <span />
          )}
          <Group>
            <Button variant="default" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void handleSave()} loading={submitting}>
              {t("common.save")}
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
