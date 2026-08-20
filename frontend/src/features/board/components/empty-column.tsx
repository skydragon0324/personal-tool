export function EmptyColumn({ label = "No tasks in this status" }: { label?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-10 text-center">
      <p className="text-sm font-medium text-[var(--app-text)]">{label}</p>
      <p className="mt-1 text-xs text-[var(--app-text-muted)]">
        Drop a card here or use Quick add.
      </p>
    </div>
  );
}
