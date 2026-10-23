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
import { t } from "@/i18n";

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
      notifySuccess(t("notifications.settingsSaved"));
      onClose();
    } catch (error) {
      notifyApiError(error, t("notifications.couldNotSaveSettings"));
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={t("notifications.settingsTitle")} size="md" radius="lg">
      {!draft ? (
        <Group justify="center" py="lg">
          {prefsQuery.isError ? <Text c="red">{t("notifications.couldNotLoadSettings")}</Text> : <Loader size="sm" />}
        </Group>
      ) : (
        <Stack gap="md">
          <section>
            <Text fw={600} size="sm" mb={6}>
              {t("notifications.desktop")}
            </Text>
            {permission === "unsupported" ? (
              <Text size="sm" c="dimmed">
                {t("notifications.desktopUnsupported")}
              </Text>
            ) : (
              <Stack gap="xs">
                <Switch
                  label={t("notifications.desktopSwitch")}
                  checked={desktopOn && permission === "granted"}
                  disabled={permission === "denied"}
                  onChange={(event) => toggleDesktop(event.currentTarget.checked)}
                />
                {permission === "default" ? (
                  <Button size="xs" variant="light" w="fit-content" onClick={() => void enableDesktop()}>
                    {t("notifications.allowDesktop")}
                  </Button>
                ) : null}
                {permission === "denied" ? (
                  <Alert color="yellow" p="xs">
                    {t("notifications.desktopBlocked")}
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
                        { id: "test", title: t("common.appName"), body: t("notifications.testBody") },
                        () => undefined,
                      )
                    }
                  >
                    {t("notifications.sendTest")}
                  </Button>
                ) : null}
              </Stack>
            )}
          </section>

          <Divider />

          <section className="space-y-3">
            <Switch
              label={t("notifications.digest")}
              description={t("notifications.digestHint")}
              checked={draft.digest_enabled}
              onChange={(event) => set("digest_enabled", event.currentTarget.checked)}
            />
            <TimeInput
              label={t("notifications.digestTime")}
              value={hhmm(draft.digest_time)}
              disabled={!draft.digest_enabled}
              onChange={(event) => set("digest_time", event.currentTarget.value || draft.digest_time)}
              maw={160}
            />
          </section>

          <section className="space-y-3">
            <Switch
              label={t("notifications.scheduleSoon")}
              description={t("notifications.scheduleSoonHint")}
              checked={draft.schedule_enabled}
              onChange={(event) => set("schedule_enabled", event.currentTarget.checked)}
            />
            <NumberInput
              label={t("notifications.minutesBefore")}
              min={0}
              max={240}
              value={draft.schedule_lead_minutes}
              disabled={!draft.schedule_enabled}
              onChange={(value) => set("schedule_lead_minutes", typeof value === "number" ? value : 0)}
              maw={160}
            />
          </section>

          <Switch
            label={t("notifications.overdueTasks")}
            description={t("notifications.overdueHint")}
            checked={draft.overdue_enabled}
            onChange={(event) => set("overdue_enabled", event.currentTarget.checked)}
          />

          <Switch
            label={t("notifications.reminders")}
            description={t("notifications.remindersHint")}
            checked={draft.task_reminders_enabled}
            onChange={(event) => set("task_reminders_enabled", event.currentTarget.checked)}
          />

          <section className="space-y-3">
            <Switch
              label={t("notifications.quietHours")}
              description={t("notifications.quietHoursHint")}
              checked={draft.quiet_hours_enabled}
              onChange={(event) => set("quiet_hours_enabled", event.currentTarget.checked)}
            />
            <Group grow maw={340}>
              <TimeInput
                label={t("notifications.from")}
                value={hhmm(draft.quiet_start)}
                disabled={!draft.quiet_hours_enabled}
                onChange={(event) => set("quiet_start", event.currentTarget.value || draft.quiet_start)}
              />
              <TimeInput
                label={t("notifications.until")}
                value={hhmm(draft.quiet_end)}
                disabled={!draft.quiet_hours_enabled}
                onChange={(event) => set("quiet_end", event.currentTarget.value || draft.quiet_end)}
              />
            </Group>
          </section>

          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void save()} loading={update.isPending}>
              {t("common.save")}
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
