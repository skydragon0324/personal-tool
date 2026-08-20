import type { Priority } from "@/features/board/types";

const styles: Record<Priority, string> = {
  high: "bg-rose-100 text-rose-900 dark:bg-rose-500/20 dark:text-rose-100",
  medium: "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100",
  low: "bg-slate-100 text-slate-800 dark:bg-slate-500/25 dark:text-slate-100",
};

const LABELS: Record<Priority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[priority]}`}
    >
      {LABELS[priority]}
    </span>
  );
}
