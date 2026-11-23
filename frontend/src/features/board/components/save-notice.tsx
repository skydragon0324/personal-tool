import { Button } from "@mantine/core";
import { randomId } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";

import { NOTICE_DURATION_MS } from "@/lib/notify";
import { t } from "@/i18n";

interface SaveNotice {
  message: string;
  outOfRange: boolean;
  hiddenByFilters: boolean;
}

/** Corner notification after saving a task, with a shortcut when the task is outside the current view. */
export function showSaveNotice(
  { message, outOfRange, hiddenByFilters }: SaveNotice,
  onViewTask?: () => void,
) {
  const id = randomId();
  notifications.show({
    id,
    color: "teal",
    title: t("board.saved"),
    autoClose: NOTICE_DURATION_MS,
    message: (
      <>
        <span className="block">{message}</span>
        {outOfRange ? <span className="mt-1 block text-sm">{t("board.outOfRange")}</span> : null}
        {hiddenByFilters ? <span className="mt-1 block text-sm">{t("board.hiddenByFilters")}</span> : null}
        {outOfRange && onViewTask ? (
          <Button
            className="mt-2"
            size="xs"
            onClick={() => {
              onViewTask();
              notifications.hide(id);
            }}
          >
            {t("board.viewTask")}
          </Button>
        ) : null}
      </>
    ),
  });
}
