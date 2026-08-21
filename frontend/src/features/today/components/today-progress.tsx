import { Progress } from "@mantine/core";

import type { TodayProgress } from "../types";
import { progressLabel, progressPercent } from "../utils/progress";

export function TodaySummaryStrip({
  greeting,
  dateLabel,
  tasks,
  schedule,
}: {
  greeting: string;
  dateLabel: string;
  tasks: TodayProgress;
  schedule: TodayProgress;
}) {
  return (
    <section
      aria-label="Today summary"
      className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="font-display text-xl text-[var(--app-text)] sm:text-2xl">{greeting}</p>
          <p className="mt-1 text-sm text-[var(--app-text-muted)]">{dateLabel}</p>
        </div>
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:max-w-md sm:grid-cols-2">
          <MiniProgress label="Tasks" progress={tasks} />
          <MiniProgress label="Schedule" progress={schedule} />
        </div>
      </div>
    </section>
  );
}

function MiniProgress({ label, progress }: { label: string; progress: TodayProgress }) {
  const percent = progressPercent(progress);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-medium text-[var(--app-text-muted)]">{label}</p>
        <p className="font-display text-sm text-[var(--app-text)]">{progressLabel(progress)}</p>
      </div>
      <Progress
        mt={6}
        value={percent}
        aria-label={`${label} ${progress.completed} / ${progress.total}`}
        color="teal"
        size="sm"
        radius="xl"
      />
    </div>
  );
}
