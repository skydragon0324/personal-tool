import { useCallback } from "react";

import { usePathname, useRouter } from "@/lib/navigation";
import { dispatchOpenTask } from "@/lib/open-task-event";

export function taskHref(boardId: string, taskId: string): string {
  return `/boards/${boardId}?task=${encodeURIComponent(taskId)}`;
}

/**
 * Opens a task's detail on its board. When that board is already on screen the page is asked to
 * open it directly (navigating to the same board would not remount it).
 */
export function useOpenTask() {
  const router = useRouter();
  const pathname = usePathname();
  return useCallback(
    (boardId: string, taskId: string) => {
      if (pathname === `/boards/${boardId}`) {
        dispatchOpenTask({ boardId, taskId });
        return;
      }
      void router.push(taskHref(boardId, taskId));
    },
    [pathname, router],
  );
}
