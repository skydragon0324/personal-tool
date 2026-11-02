import { Button, Radio, Stack, Text } from "@mantine/core";

import type { DeleteScope, EditScope } from "@/features/board/types";
import { t } from "@/i18n";

export function RecurrenceScopeDialog({
  open,
  mode,
  taskTitle,
  completed = false,
  submitting,
  onClose,
  onConfirm,
}: {
  open: boolean;
  mode: "edit" | "delete";
  taskTitle: string;
  completed?: boolean;
  submitting?: boolean;
  onClose: () => void;
  onConfirm: (scope: EditScope | DeleteScope, confirmCompleted?: boolean) => void;
}) {
  if (!open) return null;
  const isDelete = mode === "delete";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="alertdialog"
      aria-modal="true"
      aria-label={isDelete ? t("tasks.deleteRepeatingLabel") : t("tasks.editRepeatingLabel")}
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label={t("common.close")} onClick={onClose} />
      <form
        className="relative z-10 w-full max-w-md rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-xl"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const scope = String(data.get("scope") || "this") as EditScope;
          onConfirm(scope, isDelete && completed);
        }}
      >
        <h2 className="font-display text-xl text-[var(--app-text)]">
          {isDelete ? t("tasks.deleteRepeatingTitle") : t("tasks.saveRepeatingTitle")}
        </h2>
        <Text size="sm" c="dimmed" mt="sm">
          {t("tasks.isRepeating")}
        </Text>
        {isDelete && completed ? (
          <Text size="sm" mt="sm">
            {t("tasks.completedRemoved")}
          </Text>
        ) : null}
        {isDelete && !completed ? (
          <Text size="sm" mt="sm">
            {t("tasks.completedKept")}
          </Text>
        ) : null}
        <Radio.Group name="scope" defaultValue="this" mt="md">
          <Stack gap="xs">
            <Radio value="this" label={t("tasks.thisTaskOnly")} />
            {!completed ? (
              <>
                <Radio value="this_and_future" label={t("tasks.thisAndFollowing")} />
                <Radio
                  value="series"
                  label={isDelete ? t("tasks.allUnfinishedInSeries") : t("tasks.allInSeries")}
                />
              </>
            ) : null}
          </Stack>
        </Radio.Group>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" variant="default" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" color={isDelete ? "red" : undefined} loading={submitting}>
            {isDelete ? t("common.delete") : t("common.save")}
          </Button>
        </div>
      </form>
    </div>
  );
}
