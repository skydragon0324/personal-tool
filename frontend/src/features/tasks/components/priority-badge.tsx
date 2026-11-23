import type { Priority } from "@/features/board/types";
import { t } from "@/i18n";

const styles: Record<Priority, string> = {
  high: "bg-rose-100 text-rose-900 dark:bg-rose-500/20 dark:text-rose-100",
  medium: "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100",
  low: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-100",
};

export function priorityLabel(priority: Priority): string {
  if (priority === "high") return t("task.priorityHigh");
  if (priority === "low") return t("task.priorityLow");
  return t("task.priorityMedium");
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-px text-[11px] font-medium ${styles[priority]}`}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M5 21V4M5 4h13l-3 4.500 3 4.500H5" />
      </svg>
      {priorityLabel(priority)}
    </span>
  );
}
