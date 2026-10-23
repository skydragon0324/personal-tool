import { t } from "@/i18n";
export function EmptyColumn({ label = t("board.noTasksInStatus") }: { label?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-10 text-center">
      <p className="text-sm font-medium text-[var(--app-text)]">{label}</p>
      <p className="mt-1 text-xs text-[var(--app-text-muted)]">
        {t("board.dropHint")}
      </p>
    </div>
  );
}
