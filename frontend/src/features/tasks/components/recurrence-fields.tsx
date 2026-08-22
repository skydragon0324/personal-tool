"use client";

import { Checkbox, Group, NumberInput, Radio, Select, Stack, Text } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";

import type { RecurrenceInput, RecurrenceRead } from "@/features/board/types";
import { weekdayIndex } from "@/features/schedule/utils/schedule-time";

export type RepeatPreset = "none" | "daily" | "weekdays" | "weekly" | "monthly" | "yearly" | "custom";
export type RepeatUnit = "days" | "weeks" | "months" | "years";
export type RepeatEnd = "never" | "date" | "count";

const WEEKDAYS = [
  { value: 0, label: "Mon" },
  { value: 1, label: "Tue" },
  { value: 2, label: "Wed" },
  { value: 3, label: "Thu" },
  { value: 4, label: "Fri" },
  { value: 5, label: "Sat" },
  { value: 6, label: "Sun" },
];

export function presetFromRecurrence(recurrence: RecurrenceRead | RecurrenceInput | null | undefined): RepeatPreset {
  if (!recurrence) return "none";
  const interval = recurrence.interval ?? 1;
  const weekdays = [...(recurrence.weekdays ?? [])].sort().join(",");
  if (recurrence.freq === "daily" && interval === 1) return "daily";
  if (recurrence.freq === "weekly" && interval === 1 && weekdays === "0,1,2,3,4") return "weekdays";
  if (recurrence.freq === "weekly" && interval === 1 && (recurrence.weekdays ?? []).length === 1) return "weekly";
  if (recurrence.freq === "monthly" && interval === 1) return "monthly";
  if (recurrence.freq === "yearly" && interval === 1) return "yearly";
  return "custom";
}

export function recurrenceLabel(recurrence: RecurrenceRead): string {
  const preset = presetFromRecurrence(recurrence);
  if (recurrence.status !== "active") return "Repeat stopped";
  if (preset === "daily") return "Repeats daily";
  if (preset === "weekdays") return "Repeats weekdays";
  if (preset === "weekly") return "Repeats weekly";
  if (preset === "monthly") return "Repeats monthly";
  if (preset === "yearly") return "Repeats yearly";
  return "Repeats on a custom schedule";
}

export function repeatUnitFromRecurrence(
  recurrence: RecurrenceRead | RecurrenceInput | null | undefined,
): RepeatUnit {
  if (!recurrence) return "weeks";
  if (recurrence.freq === "daily") return "days";
  if (recurrence.freq === "weekly") return "weeks";
  if (recurrence.freq === "monthly") return "months";
  return "years";
}

export function buildRecurrenceInput({
  preset,
  startDate,
  customInterval,
  customUnit,
  customWeekdays,
  end,
  untilDate,
  occurrenceCount,
}: {
  preset: RepeatPreset;
  startDate: string;
  customInterval: number;
  customUnit: RepeatUnit;
  customWeekdays: number[];
  end: RepeatEnd;
  untilDate: string | null;
  occurrenceCount: number;
}): RecurrenceInput | null {
  if (preset === "none") return null;
  const weekday = weekdayIndex(startDate);
  let rule: RecurrenceInput;
  if (preset === "daily") rule = { freq: "daily", interval: 1 };
  else if (preset === "weekdays") rule = { freq: "weekly", interval: 1, weekdays: [0, 1, 2, 3, 4] };
  else if (preset === "weekly") rule = { freq: "weekly", interval: 1, weekdays: [weekday] };
  else if (preset === "monthly") rule = { freq: "monthly", interval: 1 };
  else if (preset === "yearly") rule = { freq: "yearly", interval: 1 };
  else {
    const freq =
      customUnit === "days"
        ? "daily"
        : customUnit === "weeks"
          ? "weekly"
          : customUnit === "months"
            ? "monthly"
            : "yearly";
    rule = {
      freq,
      interval: Math.max(1, customInterval),
      weekdays: freq === "weekly" ? (customWeekdays.length ? customWeekdays : [weekday]) : [],
    };
  }
  if (end === "date" && untilDate) rule.until_date = untilDate;
  if (end === "count") rule.occurrence_limit = Math.max(1, occurrenceCount);
  return rule;
}

export function RecurrenceFields({
  preset,
  onPresetChange,
  customInterval,
  onCustomIntervalChange,
  customUnit,
  onCustomUnitChange,
  customWeekdays,
  onCustomWeekdaysChange,
  end,
  onEndChange,
  untilDate,
  onUntilDateChange,
  occurrenceCount,
  onOccurrenceCountChange,
  allowNone = true,
}: {
  preset: RepeatPreset;
  onPresetChange: (value: RepeatPreset) => void;
  customInterval: number;
  onCustomIntervalChange: (value: number) => void;
  customUnit: RepeatUnit;
  onCustomUnitChange: (value: RepeatUnit) => void;
  customWeekdays: number[];
  onCustomWeekdaysChange: (value: number[]) => void;
  end: RepeatEnd;
  onEndChange: (value: RepeatEnd) => void;
  untilDate: string | null;
  onUntilDateChange: (value: string | null) => void;
  occurrenceCount: number;
  onOccurrenceCountChange: (value: number) => void;
  allowNone?: boolean;
}) {
  const presetOptions = [
    ...(allowNone ? [{ value: "none", label: "Does not repeat" }] : []),
    { value: "daily", label: "Daily" },
    { value: "weekdays", label: "Weekdays" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "yearly", label: "Yearly" },
    { value: "custom", label: "Custom" },
  ];
  return (
    <Stack gap="sm">
      <Select
        label="Repeat"
        value={preset}
        onChange={(value) => {
          if (value) onPresetChange(value as RepeatPreset);
        }}
        data={presetOptions}
      />
      {preset === "monthly" || preset === "yearly" ? (
        <Text size="xs" c="dimmed">
          {preset === "yearly"
            ? "February 29 is skipped in non-leap years."
            : "If a month has fewer days, that month is skipped."}
        </Text>
      ) : null}
      {preset === "custom" ? (
        <>
          <Group grow>
            <NumberInput
              label="Every"
              min={1}
              max={365}
              value={customInterval}
              onChange={(value) => onCustomIntervalChange(typeof value === "number" ? value : 1)}
            />
            <Select
              label="Unit"
              value={customUnit}
              onChange={(value) => {
                if (value) onCustomUnitChange(value as RepeatUnit);
              }}
              data={[
                { value: "days", label: "days" },
                { value: "weeks", label: "weeks" },
                { value: "months", label: "months" },
                { value: "years", label: "years" },
              ]}
            />
          </Group>
          {customUnit === "weeks" ? (
            <Checkbox.Group
              label="Selected weekdays"
              value={customWeekdays.map(String)}
              onChange={(values) => onCustomWeekdaysChange(values.map(Number).sort())}
            >
              <Group mt={6}>
                {WEEKDAYS.map((day) => (
                  <Checkbox key={day.value} value={String(day.value)} label={day.label} />
                ))}
              </Group>
            </Checkbox.Group>
          ) : null}
        </>
      ) : null}
      {preset !== "none" ? (
        <Radio.Group label="Ends" value={end} onChange={(value) => onEndChange(value as RepeatEnd)}>
          <Stack gap={6} mt={6}>
            <Radio value="never" label="Never" />
            <Radio value="date" label="On date" />
            {end === "date" ? (
              <DatePickerInput
                value={untilDate}
                onChange={(value) => onUntilDateChange(typeof value === "string" && value ? value : null)}
                valueFormat="MMM D, YYYY"
              />
            ) : null}
            <Radio value="count" label="After a number of occurrences" />
            {end === "count" ? (
              <NumberInput
                min={1}
                max={999}
                value={occurrenceCount}
                onChange={(value) => onOccurrenceCountChange(typeof value === "number" ? value : 1)}
              />
            ) : null}
          </Stack>
        </Radio.Group>
      ) : null}
    </Stack>
  );
}
