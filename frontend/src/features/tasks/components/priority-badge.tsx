import type { Priority } from "@/features/board/types";
import { t } from "@/i18n";

const styles: Record<Priority, string> = {
  high: "bg-rose-100 text-rose-900 dark:bg-rose-500/20 dark:text-rose-100",
  medium: "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100",
  low: "bg-slate-100 text-slate-800 dark:bg-slate-500/25 dark:text-slate-100",
};

export function priorityLabel(priority: Priority): string {
  if (priority === "high") return t("task.priorityHigh");
  if (priority === "low") return t("task.priorityLow");
  return t("task.priorityMedium");
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-px text-[11px] font-medium ${styles[priority]}`}
    >
      {priorityLabel(priority)}
    </span>
  );
}
