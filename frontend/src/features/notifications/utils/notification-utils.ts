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
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24 && at.getDate() === now.getDate()) return `${hours} h ago`;
  return at.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
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
