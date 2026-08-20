import type { BoardSummary } from "../types";
import { BOARD_CONTENT_GUTTER } from "../utils/board-layout";

interface BoardSummaryProps {
  summary: BoardSummary;
  dateLabel: string;
  loading?: boolean;
  truncated?: boolean;
  taskLimit?: number;
}

export function BoardSummaryCard({
  summary,
  dateLabel,
  loading,
  truncated,
  taskLimit,
}: BoardSummaryProps) {
  const cards = [
    { label: "Total", value: summary.total },
    { label: "Completed", value: summary.completed },
    { label: "Remaining", value: summary.remaining },
  ];

  return (
    <section className={`${BOARD_CONTENT_GUTTER} mb-4 mt-6`}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="font-display text-lg text-[var(--app-text)]">Board summary</h2>
        <p className="text-sm text-[var(--app-text-muted)]">{dateLabel}</p>
      </div>
      {truncated ? (
        <p className="mb-3 rounded-xl border border-amber-300/70 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
          Reached the display limit ({taskLimit ?? 500} tasks). Narrow the date range for a more
          precise view.
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-4 shadow-sm"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--app-text-muted)]">
              {card.label}
            </p>
            <p className="mt-2 font-display text-3xl font-semibold text-[var(--app-text)]">
              {loading ? "—" : card.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
