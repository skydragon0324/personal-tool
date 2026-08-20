import { Progress, Text } from "@mantine/core";

import type { TodayProgress } from "../types";
import { progressLabel, progressPercent } from "../utils/progress";

export function TodayProgressOverview({
  tasks,
  schedule,
}: {
  tasks: TodayProgress;
  schedule: TodayProgress;
}) {
  return (
    <section aria-label="Progress overview" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <ProgressCard label="Tasks" progress={tasks} />
      <ProgressCard label="Schedule" progress={schedule} />
    </section>
  );
}

function ProgressCard({ label, progress }: { label: string; progress: TodayProgress }) {
  const percent = progressPercent(progress);
  return (
    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg text-[var(--app-text)]">{label}</h2>
        <Text size="sm" c="dimmed">
          {progressLabel(progress)}
        </Text>
      </div>
      <Progress
        mt="sm"
        value={percent}
        aria-label={`${label} ${percent}%`}
        color="teal"
        size="lg"
        radius="xl"
      />
      <p className="mt-2 text-sm font-medium text-[var(--app-text-muted)]">{percent}%</p>
    </div>
  );
}
