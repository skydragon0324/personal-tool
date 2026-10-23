import { ApiError } from "@/lib/api-client";
import { notifications } from "@mantine/notifications";

import { t } from "@/i18n";

export function notifyApiError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = error instanceof ApiError ? error.status : undefined;
  notifications.show({
    color: "red",
    title: status ? t("common.requestFailedStatus", { status }) : t("common.requestFailed"),
    message,
  });
}

export function notifySuccess(message: string) {
  notifications.show({ color: "teal", message });
}

export function notifyConflict(message = t("common.versionConflict")) {
  notifications.show({
    color: "yellow",
    title: t("common.versionConflictTitle"),
    message,
  });
}
