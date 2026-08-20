import type { TodayProgress } from "../types";

export function progressLabel(progress: TodayProgress): string {
  return `${progress.completed} / ${progress.total}`;
}

export function progressPercent(progress: TodayProgress): number {
  if (progress.total <= 0) return 0;
  return progress.percentage;
}
