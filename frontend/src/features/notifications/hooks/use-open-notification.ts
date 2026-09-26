"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";

import { dispatchOpenTask } from "@/lib/open-task-event";

import type { AppNotification } from "../types";
import { notificationHref } from "../utils/notification-utils";
import { useNotificationMutations } from "./use-notifications";

/** Mark a notification read and take the user to what it is about. */
export function useOpenNotification() {
  const router = useRouter();
  const pathname = usePathname();
  const { markRead } = useNotificationMutations();
  const { mutate } = markRead;

  return useCallback(
    (item: AppNotification) => {
      if (!item.read_at) mutate(item.id);
      if (
        item.board_id &&
        item.task_id &&
        pathname === `/boards/${item.board_id}`
      ) {
        dispatchOpenTask({ boardId: item.board_id, taskId: item.task_id });
        return;
      }
      router.push(notificationHref(item));
    },
    [mutate, pathname, router],
  );
}
