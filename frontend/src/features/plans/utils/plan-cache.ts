import type { PlanDay, PlanDetail, PlanItem, PlanSummary } from "../types";

/** Recompute the list-level counts from the days, so optimistic edits keep progress in sync. */
export function withCounts(plan: PlanDetail): PlanDetail {
  const items = plan.days.flatMap((day) => day.items);
  const dates = plan.days.map((day) => day.day).sort();
  return {
    ...plan,
    day_count: plan.days.length,
    item_count: items.length,
    completed_count: items.filter((item) => item.is_completed).length,
    first_day: dates[0] ?? null,
    last_day: dates[dates.length - 1] ?? null,
  };
}

export function sortDays(days: PlanDay[]): PlanDay[] {
  return [...days].sort((a, b) => a.day.localeCompare(b.day));
}

function mapDay(plan: PlanDetail, dayId: string, update: (day: PlanDay) => PlanDay): PlanDetail {
  return withCounts({ ...plan, days: plan.days.map((day) => (day.id === dayId ? update(day) : day)) });
}

export function upsertDay(plan: PlanDetail, day: PlanDay): PlanDetail {
  const others = plan.days.filter((existing) => existing.id !== day.id);
  return withCounts({ ...plan, days: sortDays([...others, day]) });
}

export function removeDay(plan: PlanDetail, dayId: string): PlanDetail {
  return withCounts({ ...plan, days: plan.days.filter((day) => day.id !== dayId) });
}

export function upsertItem(plan: PlanDetail, item: PlanItem): PlanDetail {
  return mapDay(plan, item.day_id, (day) => {
    const exists = day.items.some((existing) => existing.id === item.id);
    const items = exists
      ? day.items.map((existing) => (existing.id === item.id ? item : existing))
      : [...day.items, item];
    return { ...day, items: [...items].sort((a, b) => a.position - b.position) };
  });
}

export function patchItem(
  plan: PlanDetail,
  itemId: string,
  patch: Partial<Pick<PlanItem, "title" | "is_completed">>,
): PlanDetail {
  const day = plan.days.find((entry) => entry.items.some((item) => item.id === itemId));
  if (!day) return plan;
  return mapDay(plan, day.id, (current) => ({
    ...current,
    items: current.items.map((item) => {
      if (item.id !== itemId) return item;
      const next = { ...item, ...patch };
      if (patch.is_completed !== undefined && patch.is_completed !== item.is_completed) {
        next.completed_at = patch.is_completed ? new Date().toISOString() : null;
      }
      return next;
    }),
  }));
}

export function removeItem(plan: PlanDetail, itemId: string): PlanDetail {
  return withCounts({
    ...plan,
    days: plan.days.map((day) => ({ ...day, items: day.items.filter((item) => item.id !== itemId) })),
  });
}

/** The list entry for a plan, taken from its detail. */
export function summaryFromDetail(detail: PlanDetail): PlanSummary {
  const summary: PlanSummary & { days?: PlanDay[] } = { ...detail };
  delete summary.days;
  return summary;
}

export function replaceInList(list: PlanSummary[] | undefined, plan: PlanSummary): PlanSummary[] | undefined {
  if (!list) return list;
  return list.some((entry) => entry.id === plan.id)
    ? list.map((entry) => (entry.id === plan.id ? plan : entry))
    : [...list, plan];
}

export function dayProgress(day: PlanDay): { done: number; total: number } {
  return { done: day.items.filter((item) => item.is_completed).length, total: day.items.length };
}
