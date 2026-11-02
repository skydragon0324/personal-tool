import { dateLocale, getLanguage, t, translateServerText } from "@/i18n";
import { formatDisplayDate } from "@/lib/dates";

import type { AppNotification } from "../types";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

/** Keys use the `life-management:` prefix so logout clears them (see clear-user-state). */
export const DESKTOP_PREF_KEY = "life-management:notifications:desktop";
export const LAST_ANNOUNCED_KEY = "life-management:notifications:last-announced";
export const PERMISSION_PROMPTED_KEY = "life-management:notifications:permission-prompted";

/** On first run only announce notifications created shortly before the first poll. */
const FIRST_RUN_WINDOW_MS = 2 * 60 * 1000;

function safeGet(storage: StorageLike | null | undefined, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSet(storage: StorageLike | null | undefined, key: string, value: string): void {
  try {
    storage?.setItem(key, value);
  } catch {
    /* storage unavailable (private mode, quota) — announcing still works for this session */
  }
}

export function readDesktopEnabled(storage: StorageLike | null | undefined): boolean {
  return safeGet(storage, DESKTOP_PREF_KEY) !== "off";
}

export function writeDesktopEnabled(storage: StorageLike | null | undefined, enabled: boolean): void {
  safeSet(storage, DESKTOP_PREF_KEY, enabled ? "on" : "off");
}

export function readPermissionPrompted(storage: StorageLike | null | undefined): boolean {
  return safeGet(storage, PERMISSION_PROMPTED_KEY) === "1";
}

export function writePermissionPrompted(storage: StorageLike | null | undefined): void {
  safeSet(storage, PERMISSION_PROMPTED_KEY, "1");
}

/**
 * Pick unread notifications that have not been announced yet (oldest first) and advance the
 * watermark. Announcing is shared across tabs through storage so each item pops up once.
 */
export function takeUnannounced(
  items: AppNotification[],
  serverTime: string,
  storage: StorageLike | null | undefined,
): AppNotification[] {
  const stored = safeGet(storage, LAST_ANNOUNCED_KEY);
  const storedMs = stored ? Date.parse(stored) : Number.NaN;
  const watermark = Number.isNaN(storedMs)
    ? Date.parse(serverTime) - FIRST_RUN_WINDOW_MS
    : storedMs;

  const fresh = items
    .filter((item) => item.read_at === null && Date.parse(item.created_at) > watermark)
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));

  const newest = items.reduce(
    (max, item) => Math.max(max, Date.parse(item.created_at)),
    watermark,
  );
  if (Number.isNaN(storedMs) || newest > storedMs) {
    safeSet(storage, LAST_ANNOUNCED_KEY, new Date(newest).toISOString());
  }
  return fresh;
}

export function notificationHref(item: AppNotification): string {
  if (item.board_id && item.task_id) {
    return `/boards/${item.board_id}?task=${item.task_id}`;
  }
  if (item.kind === "board_shared" && item.board_id) return `/boards/${item.board_id}`;
  return "/today";
}

export function formatNotificationTime(iso: string, now: Date = new Date()): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  const diffMs = now.getTime() - at.getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return t("notifications.justNow");
  if (minutes < 60) return t("notifications.minutesAgo", { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24 && at.getDate() === now.getDate()) return t("notifications.hoursAgo", { count: hours });
  return at.toLocaleString(dateLocale(), {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** The notification title in the current language (the digest has a fixed title). */
export function notificationTitle(item: Pick<AppNotification, "kind" | "title">): string {
  return item.kind === "daily_digest" ? t("notificationBodies.digestTitle") : item.title;
}

/**
 * The notification body in the current language. The server stores English text plus a key and
 * values; older notifications have only the English text, which is shown as it is.
 */
export function notificationBody(item: Pick<AppNotification, "body" | "body_key" | "body_params">): string {
  const key = item.body_key;
  if (!key || getLanguage() === "en") return item.body;
  const params: Record<string, string | number> = { ...(item.body_params ?? {}) };
  if (typeof params.due === "string") params.due = formatDisplayDate(params.due);
  if (key === "daily_digest") {
    const count = (name: string) => Number(params[name] ?? 0);
    const parts = [
      count("due_today") ? t("notificationBodies.digestDueToday", { count: count("due_today") }) : "",
      count("overdue") ? t("notificationBodies.digestOverdue", { count: count("overdue") }) : "",
      count("scheduled") ? t("notificationBodies.digestScheduled", { count: count("scheduled") }) : "",
    ].filter(Boolean);
    return parts.length ? parts.join(" · ") : item.body;
  }
  const resolved = key === "task_overdue" && Number(params.days) <= 1 ? "task_overdue_yesterday" : key;
  return translateServerText("notificationBodies", resolved, params, item.body);
}

export function desktopNotificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function desktopPermission(): NotificationPermission | "unsupported" {
  return desktopNotificationsSupported() ? Notification.permission : "unsupported";
}

export async function requestDesktopPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!desktopNotificationsSupported()) return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/** Show an OS-level notification. `tag` makes duplicate announcements from other tabs collapse. */
export function showDesktopNotification(
  item: Pick<AppNotification, "id" | "title" | "body">,
  onClick: () => void,
): boolean {
  if (!desktopNotificationsSupported() || Notification.permission !== "granted") return false;
  try {
    const popup = new Notification(item.title, {
      body: item.body,
      tag: item.id,
      icon: "/favicon.ico",
    });
    popup.onclick = () => {
      window.focus();
      onClick();
      popup.close();
    };
    return true;
  } catch {
    return false;
  }
}
