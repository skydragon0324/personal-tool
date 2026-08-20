import { ApiError } from "@/lib/api-client";
import { notifications } from "@mantine/notifications";

export function notifyApiError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = error instanceof ApiError ? error.status : undefined;
  notifications.show({
    color: "red",
    title: status ? `Request failed (${status})` : "Request failed",
    message,
  });
}

export function notifySuccess(message: string) {
  notifications.show({ color: "teal", message });
}

export function notifyConflict(message = "This item changed elsewhere. Refreshing — please try again.") {
  notifications.show({
    color: "yellow",
    title: "Version conflict",
    message,
  });
}
