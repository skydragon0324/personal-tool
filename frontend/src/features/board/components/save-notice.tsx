import { Alert, Button } from "@mantine/core";
import { t } from "@/i18n";

interface SaveNoticeProps {
  message: string;
  outOfRange: boolean;
  hiddenByFilters: boolean;
  onViewTask?: () => void;
  onDismiss: () => void;
}

export function SaveNotice({
  message,
  outOfRange,
  hiddenByFilters,
  onViewTask,
  onDismiss,
}: SaveNoticeProps) {
  return (
    <Alert
      color="teal"
      variant="light"
      withCloseButton
      onClose={onDismiss}
      title={t("board.saved")}
      className="mx-auto mt-4 max-w-[1400px] px-4 sm:px-6"
    >
      <p>{message}</p>
      {outOfRange ? (
        <p className="mt-1 text-sm">{t("board.outOfRange")}</p>
      ) : null}
      {hiddenByFilters ? (
        <p className="mt-1 text-sm">
          {t("board.hiddenByFilters")}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {outOfRange && onViewTask ? (
          <Button size="xs" onClick={onViewTask}>
            {t("board.viewTask")}
          </Button>
        ) : null}
      </div>
    </Alert>
  );
}
