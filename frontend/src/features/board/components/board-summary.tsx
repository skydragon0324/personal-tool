import type { BoardSummary } from "../types";
import { BOARD_CONTENT_GUTTER } from "../utils/board-layout";
import { CalendarIcon, CheckCircleIcon, CircleIcon, LayersIcon } from "./board-ui-icons";
import { t } from "@/i18n";

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
    { label: t("board.total"), value: summary.total, icon: <LayersIcon size={18} /> },
    { label: t("board.completed"), value: summary.completed, icon: <CheckCircleIcon size={18} className="text-[var(--app-primary)]" /> },
    { label: t("board.remaining"), value: summary.remaining, icon: <CircleIcon size={18} /> },
  ];

  return (
    <section className={`${BOARD_CONTENT_GUTTER} mb-3 mt-3 shrink-0`}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl bg-[var(--app-primary-soft)] px-4 py-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
          <h2 className="font-display text-lg font-semibold text-[var(--app-text)]">{t("board.summaryTitle")}</h2>
          <span aria-hidden className="hidden h-5 w-px bg-[var(--app-text-muted)] opacity-40 sm:block" />
          <p className="flex items-center gap-2 text-sm text-[var(--app-text)]">
            <CalendarIcon />
            {dateLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {cards.map((card) => (
            <div
              key={card.label}
              className="flex min-w-[8.5rem] items-center gap-2 rounded-full bg-[var(--app-surface)] px-3.5 py-1.5 text-sm text-[var(--app-text)]"
            >
              {card.icon}
              <span>{card.label}</span>
              <span className="ml-auto pl-3 font-semibold">{loading ? "—" : card.value}</span>
            </div>
          ))}
        </div>
      </div>
      {truncated ? (
        <p className="mt-2 rounded-xl border border-amber-300/70 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
          {t("board.displayLimit", { limit: taskLimit ?? 500 })}
        </p>
      ) : null}
    </section>
  );
}
