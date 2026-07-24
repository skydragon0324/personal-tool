import type { DashboardSummary } from "@/lib/types";

interface DashboardSummaryProps {
  summary: DashboardSummary | null;
  loading: boolean;
  dateLabel: string;
}

export function DashboardSummaryCard({
  summary,
  loading,
  dateLabel,
}: DashboardSummaryProps) {
  const cards = [
    {
      label: "Total today",
      value: summary?.total_today ?? 0,
      tone: "text-ink",
    },
    {
      label: "Completed",
      value: summary?.completed_today ?? 0,
      tone: "text-teal-700",
    },
    {
      label: "Remaining",
      value: summary?.remaining_today ?? 0,
      tone: "text-amber-700",
    },
  ];

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="font-display text-xl text-ink">Dashboard</h2>
        <p className="text-sm text-slate-500">{dateLabel}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-4 shadow-sm backdrop-blur"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {card.label}
            </p>
            <p
              className={`mt-2 font-display text-3xl font-semibold ${card.tone}`}
            >
              {loading ? "—" : card.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
