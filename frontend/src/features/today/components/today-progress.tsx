import { Progress } from "@mantine/core";

import type { TodayProgress } from "../types";
import { progressLabel, progressPercent } from "../utils/progress";
import { t } from "@/i18n";

/** Today's task and schedule progress, compact enough to sit in the page header. */
export function TodaySummaryStrip({ tasks, schedule }: { tasks: TodayProgress; schedule: TodayProgress }) {
  return (
    <section aria-label={t("today.summaryLabel")} className="flex flex-wrap items-center gap-2">
      <MiniProgress label={t("today.tasks")} progress={tasks} />
      <MiniProgress label={t("today.schedule")} progress={schedule} />
    </section>
  );
}

function MiniProgress({ label, progress }: { label: string; progress: TodayProgress }) {
  const percent = progressPercent(progress);
  return (
    <div className="w-44 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold text-[var(--app-text-muted)]">{label}</p>
        <p className="text-sm font-semibold text-[var(--app-text)]">{progressLabel(progress)}</p>
      </div>
      <Progress
        mt={4}
        value={percent}
        aria-label={`${label} ${progress.completed} / ${progress.total}`}
        color="teal"
        size="xs"
        radius="xl"
      />
    </div>
  );
}
