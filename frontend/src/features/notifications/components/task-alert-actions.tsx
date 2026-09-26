"use client";

import { Button, Group } from "@mantine/core";
import { DatePicker, TimeInput } from "@mantine/dates";
import dayjs from "dayjs";
import { useState } from "react";

import { notifyApiError, notifySuccess } from "@/lib/notify";

import { useNotificationMutations } from "../hooks/use-notifications";
import type { AppNotification } from "../types";
import { snoozeOptions } from "../utils/snooze-options";

/** Kinds about a task the user can act on: remind again later, mark done, or close. */
export function isTaskAlert(item: AppNotification): boolean {
  return (item.kind === "task_overdue" || item.kind === "task_reminder") && Boolean(item.task_id);
}

/**
 * Remind me / Complete / Close for an overdue or reminder notification.
 * Close hides the notice for good; Remind me brings it back as a reminder at the chosen time.
 * Choices expand inline (no floating menus) so they are never clipped by the notification list.
 */
export function TaskAlertActions({ item }: { item: AppNotification }) {
  const { snooze, completeTask, dismiss } = useNotificationMutations();
  const [mode, setMode] = useState<"closed" | "choices" | "custom">("closed");
  const [day, setDay] = useState<string | null>(null);
  const [time, setTime] = useState("09:00");

  function remindAt(at: Date) {
    setMode("closed");
    snooze.mutate(
      { id: item.id, remindAt: dayjs(at).format() },
      {
        onSuccess: () => notifySuccess(`We'll remind you ${dayjs(at).format("MMM D [at] HH:mm")}`),
        onError: (error) => notifyApiError(error, "Could not set the reminder"),
      },
    );
  }

  const custom = day && /^\d{2}:\d{2}$/.test(time) ? dayjs(`${day} ${time}`) : null;

  return (
    <div className="mt-1.5">
      <Group gap={4} wrap="nowrap">
        <Button
          size="compact-xs"
          variant={mode === "closed" ? "light" : "filled"}
          onClick={() => setMode(mode === "closed" ? "choices" : "closed")}
          aria-expanded={mode !== "closed"}
        >
          Remind me
        </Button>
        <Button
          size="compact-xs"
          variant="light"
          color="teal"
          onClick={() =>
            completeTask.mutate(item.id, {
              onSuccess: () => notifySuccess(`Marked “${item.title}” as completed`),
              onError: (error) => notifyApiError(error, "Could not complete the task"),
            })
          }
        >
          Complete
        </Button>
        <Button
          size="compact-xs"
          variant="subtle"
          color="gray"
          title="Stop notifying me about this task"
          onClick={() => dismiss.mutate(item.id)}
        >
          Close
        </Button>
      </Group>

      {mode === "choices" ? (
        <div className="mt-1.5 flex flex-wrap gap-1" role="group" aria-label="Remind me when">
          {snoozeOptions().map((option) => (
            <Button key={option.label} size="compact-xs" variant="default" onClick={() => remindAt(option.at)}>
              {option.label}
            </Button>
          ))}
          <Button
            size="compact-xs"
            variant="default"
            onClick={() => {
              setDay(dayjs().add(1, "day").format("YYYY-MM-DD"));
              setMode("custom");
            }}
          >
            Pick a time…
          </Button>
        </div>
      ) : null}

      {mode === "custom" ? (
        <div className="mt-2 space-y-2">
          <DatePicker size="xs" value={day} onChange={setDay} minDate={dayjs().format("YYYY-MM-DD")} />
          <Group gap={4} align="flex-end">
            <TimeInput
              size="xs"
              label="Time"
              value={time}
              onChange={(event) => setTime(event.currentTarget.value)}
              w={100}
            />
            <Button size="compact-sm" variant="default" onClick={() => setMode("choices")}>
              Back
            </Button>
            <Button
              size="compact-sm"
              disabled={!custom || !custom.isAfter(dayjs())}
              onClick={() => custom && remindAt(custom.toDate())}
            >
              Set reminder
            </Button>
          </Group>
        </div>
      ) : null}
    </div>
  );
}
