"use client";

import { Alert, Button, Divider, Group, Loader, Modal, NumberInput, Stack, Switch, Text } from "@mantine/core";
import { TimeInput } from "@mantine/dates";
import { useEffect, useState } from "react";

import { notifyApiError, notifySuccess } from "@/lib/notify";

import { useNotificationPreferences, useUpdateNotificationPreferences } from "../hooks/use-notifications";
import type { NotificationPreferences } from "../types";
import {
  desktopPermission,
  readDesktopEnabled,
  requestDesktopPermission,
  showDesktopNotification,
  writeDesktopEnabled,
} from "../utils/notification-utils";

const hhmm = (value: string) => value.slice(0, 5);

export function NotificationSettingsModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const prefsQuery = useNotificationPreferences(opened);
  const update = useUpdateNotificationPreferences();
  const [draft, setDraft] = useState<NotificationPreferences | null>(null);
  const [desktopOn, setDesktopOn] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    if (!opened) return;
    setDesktopOn(readDesktopEnabled(window.localStorage));
    setPermission(desktopPermission());
  }, [opened]);

  useEffect(() => {
    if (opened && prefsQuery.data) setDraft(prefsQuery.data);
  }, [opened, prefsQuery.data]);

  function set<K extends keyof NotificationPreferences>(key: K, value: NotificationPreferences[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  async function enableDesktop() {
    const result = await requestDesktopPermission();
    setPermission(result);
    if (result === "granted") {
      writeDesktopEnabled(window.localStorage, true);
      setDesktopOn(true);
    }
  }

  function toggleDesktop(next: boolean) {
    setDesktopOn(next);
    writeDesktopEnabled(window.localStorage, next);
    if (next && permission === "default") void enableDesktop();
  }

  async function save() {
    if (!draft) return;
    try {
      await update.mutateAsync({
        ...draft,
        digest_time: hhmm(draft.digest_time),
        quiet_start: hhmm(draft.quiet_start),
        quiet_end: hhmm(draft.quiet_end),
      });
      notifySuccess("Notification settings saved");
      onClose();
    } catch (error) {
      notifyApiError(error, "Could not save notification settings");
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Notification settings" size="md" radius="lg">
      {!draft ? (
        <Group justify="center" py="lg">
          {prefsQuery.isError ? <Text c="red">Could not load settings.</Text> : <Loader size="sm" />}
        </Group>
      ) : (
        <Stack gap="md">
          <section>
            <Text fw={600} size="sm" mb={6}>
              Desktop notifications
            </Text>
            {permission === "unsupported" ? (
              <Text size="sm" c="dimmed">
                This browser does not support desktop notifications.
              </Text>
            ) : (
              <Stack gap="xs">
                <Switch
                  label="Show notifications from the operating system while the app is open"
                  checked={desktopOn && permission === "granted"}
                  disabled={permission === "denied"}
                  onChange={(event) => toggleDesktop(event.currentTarget.checked)}
                />
                {permission === "default" ? (
                  <Button size="xs" variant="light" w="fit-content" onClick={() => void enableDesktop()}>
                    Allow desktop notifications
                  </Button>
                ) : null}
                {permission === "denied" ? (
                  <Alert color="yellow" p="xs">
                    Desktop notifications are blocked for this site. Allow them in your browser&apos;s site
                    settings, then reopen this dialog.
                  </Alert>
                ) : null}
                {permission === "granted" && desktopOn ? (
                  <Button
                    size="xs"
                    variant="subtle"
                    w="fit-content"
                    px={0}
                    onClick={() =>
                      showDesktopNotification(
                        { id: "test", title: "Life Management", body: "Desktop notifications are on." },
                        () => undefined,
                      )
                    }
                  >
                    Send a test notification
                  </Button>
                ) : null}
              </Stack>
            )}
          </section>

          <Divider />

          <section className="space-y-3">
            <Switch
              label="Daily digest"
              description="A summary of tasks due today, overdue tasks and today's schedule."
              checked={draft.digest_enabled}
              onChange={(event) => set("digest_enabled", event.currentTarget.checked)}
            />
            <TimeInput
              label="Digest time"
              value={hhmm(draft.digest_time)}
              disabled={!draft.digest_enabled}
              onChange={(event) => set("digest_time", event.currentTarget.value || draft.digest_time)}
              maw={160}
            />
          </section>

          <section className="space-y-3">
            <Switch
              label="Schedule starting soon"
              description="Alert before a schedule entry starts, unless it is already marked done."
              checked={draft.schedule_enabled}
              onChange={(event) => set("schedule_enabled", event.currentTarget.checked)}
            />
            <NumberInput
              label="Minutes before start"
              min={0}
              max={240}
              value={draft.schedule_lead_minutes}
              disabled={!draft.schedule_enabled}
              onChange={(value) => set("schedule_lead_minutes", typeof value === "number" ? value : 0)}
              maw={160}
            />
          </section>

          <Switch
            label="Overdue tasks"
            description="When a task is past its due date and not finished. From the notice you can get reminded later, mark it completed, or close it."
            checked={draft.overdue_enabled}
            onChange={(event) => set("overdue_enabled", event.currentTarget.checked)}
          />

          <Switch
            label="Reminders"
            description="Alerts at the time you picked with “Remind me”."
            checked={draft.task_reminders_enabled}
            onChange={(event) => set("task_reminders_enabled", event.currentTarget.checked)}
          />

          <section className="space-y-3">
            <Switch
              label="Quiet hours"
              description="Task reminders and the digest are held until quiet hours end; schedule alerts during these hours are skipped."
              checked={draft.quiet_hours_enabled}
              onChange={(event) => set("quiet_hours_enabled", event.currentTarget.checked)}
            />
            <Group grow maw={340}>
              <TimeInput
                label="From"
                value={hhmm(draft.quiet_start)}
                disabled={!draft.quiet_hours_enabled}
                onChange={(event) => set("quiet_start", event.currentTarget.value || draft.quiet_start)}
              />
              <TimeInput
                label="Until"
                value={hhmm(draft.quiet_end)}
                disabled={!draft.quiet_hours_enabled}
                onChange={(event) => set("quiet_end", event.currentTarget.value || draft.quiet_end)}
              />
            </Group>
          </section>

          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => void save()} loading={update.isPending}>
              Save
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
