import { t } from "@/i18n";

interface DeleteTaskDialogProps {
  open: boolean;
  taskTitle: string;
  submitting?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function DeleteTaskDialog({
  open,
  taskTitle,
  submitting,
  onConfirm,
  onClose,
}: DeleteTaskDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="alertdialog"
      aria-modal="true"
      aria-label={t("tasks.deleteTask")}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label={t("common.close")}
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-xl">
        <h2 className="font-display text-xl text-[var(--app-text)]">{t("tasks.deleteThisTask")}</h2>
        <p className="mt-2 text-sm text-[var(--app-text-muted)]">
          {t("tasks.willBeRemoved", { title: taskTitle })}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={onConfirm}
            className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60"
          >
            {submitting ? t("tasks.deleting") : t("common.delete")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-2 text-sm font-medium text-[var(--app-text)] hover:bg-[var(--app-surface-muted)]"
          >
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
