import { Button, Group, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useEffect, useRef } from "react";

import { useNotificationFeed } from "../hooks/use-notifications";
import { useOpenNotification } from "../hooks/use-open-notification";
import type { AppNotification, NotificationKind } from "../types";
import {
  desktopPermission,
  notificationBody,
  notificationTitle,
  readDesktopEnabled,
  readPermissionPrompted,
  requestDesktopPermission,
  showDesktopNotification,
  takeUnannounced,
  writeDesktopEnabled,
  writePermissionPrompted,
} from "../utils/notification-utils";
import { t } from "@/i18n";

/** Individual pop-ups per poll; anything beyond is summarized so a backlog does not flood the screen. */
const MAX_INDIVIDUAL = 3;
const PERMISSION_TOAST_ID = "desktop-notification-permission";

const KIND_COLOR: Record<NotificationKind, string> = {
  daily_digest: "teal",
  schedule_start: "blue",
  task_reminder: "orange",
  board_shared: "violet",
  task_assigned: "indigo",
  task_overdue: "red",
};

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Announces new notifications while the workspace is open: an in-app toast when the tab is
 * visible and an OS notification (via the browser Notification API) whenever it is allowed.
 */
export function NotificationBridge() {
  const feed = useNotificationFeed();
  const open = useOpenNotification();
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    const data = feed.data;
    if (!data) return;
    const store = storage();
    const fresh = takeUnannounced(data.items, data.server_time, store);
    if (!fresh.length) return;

    const desktop = readDesktopEnabled(store);
    const visible = document.visibilityState === "visible";
    const shown = fresh.slice(-MAX_INDIVIDUAL);
    const hiddenCount = fresh.length - shown.length;

    for (const item of shown) {
      if (desktop) {
        const text = { id: item.id, title: notificationTitle(item), body: notificationBody(item) };
        showDesktopNotification(text, () => openRef.current(item));
      }
      if (visible) showToast(item, () => openRef.current(item));
    }
    if (hiddenCount > 0) {
      const summary = {
        id: `summary-${shown[shown.length - 1].id}`,
        title: t("notifications.moreNotifications", { count: hiddenCount }),
        body: t("notifications.openBell"),
      };
      if (desktop) showDesktopNotification(summary, () => window.focus());
      if (visible) notifications.show({ title: summary.title, message: summary.body, color: "gray" });
    }
  }, [feed.data]);

  useEffect(() => {
    const store = storage();
    if (
      desktopPermission() !== "default" ||
      !readDesktopEnabled(store) ||
      readPermissionPrompted(store)
    ) {
      return;
    }
    notifications.show({
      id: PERMISSION_TOAST_ID,
      autoClose: false,
      color: "teal",
      title: t("notifications.turnOnTitle"),
      message: (
        <div>
          <Text size="sm" c="dimmed">
            {t("notifications.turnOnBody")}
          </Text>
          <Group gap="xs" mt="xs">
            <Button
              size="xs"
              onClick={() => {
                writePermissionPrompted(store);
                notifications.hide(PERMISSION_TOAST_ID);
                void requestDesktopPermission().then((result) => {
                  if (result === "granted") writeDesktopEnabled(store, true);
                });
              }}
            >
              {t("notifications.turnOn")}
            </Button>
            <Button
              size="xs"
              variant="subtle"
              color="gray"
              onClick={() => {
                writePermissionPrompted(store);
                notifications.hide(PERMISSION_TOAST_ID);
              }}
            >
              {t("notifications.notNow")}
            </Button>
          </Group>
        </div>
      ),
    });
  }, []);

  return null;
}

function showToast(item: AppNotification, onOpen: () => void) {
  const id = `notification-${item.id}`;
  notifications.show({
    id,
    color: KIND_COLOR[item.kind],
    title: notificationTitle(item),
    autoClose: 8000,
    message: (
      <div>
        {notificationBody(item) ? <Text size="sm">{notificationBody(item)}</Text> : null}
        <Button
          size="compact-xs"
          variant="subtle"
          mt={4}
          px={0}
          onClick={() => {
            notifications.hide(id);
            onOpen();
          }}
        >
          {t("notifications.open")}
        </Button>
      </div>
    ),
  });
}
