import type { BoardSummary } from "../types";

interface BoardSummaryProps {
  summary: BoardSummary;
  dateLabel: string;
  loading?: boolean;
}

export function BoardSummaryCard({
  summary,
  dateLabel,
  loading,
}: BoardSummaryProps) {
  const cards = [
    { label: "Total", value: summary.total, tone: "text-ink" },
    { label: "Completed", value: summary.completed, tone: "text-teal-700" },
    { label: "Remaining", value: summary.remaining, tone: "text-amber-700" },
  ];

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="font-display text-xl text-ink">Board pulse</h2>
        <p className="text-sm text-slate-500">{dateLabel}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-4 shadow-sm"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {card.label}
            </p>
            <p className={`mt-2 font-display text-3xl font-semibold ${card.tone}`}>
              {loading ? "—" : card.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
