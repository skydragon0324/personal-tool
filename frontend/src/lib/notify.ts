import { ApiError } from "@/lib/api-client";
import { notifications } from "@mantine/notifications";

import { t } from "@/i18n";

/** How long action feedback stays on screen. Hovering a notification keeps it open. */
export const NOTICE_DURATION_MS = 3000;

export function notifyApiError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = error instanceof ApiError ? error.status : undefined;
  notifications.show({
    color: "red",
    title: status ? t("common.requestFailedStatus", { status }) : t("common.requestFailed"),
    message,
    autoClose: NOTICE_DURATION_MS,
  });
}

export function notifySuccess(message: string) {
  notifications.show({ color: "teal", message, autoClose: NOTICE_DURATION_MS });
}

export function notifyConflict(message = t("common.versionConflict")) {
  notifications.show({
    color: "yellow",
    title: t("common.versionConflictTitle"),
    message,
    autoClose: NOTICE_DURATION_MS,
  });
}
