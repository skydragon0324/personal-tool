"use client";

import { Badge, Checkbox, Progress, Tooltip } from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";

import { DashboardGrid, DashboardPanel, PanelEmpty } from "@/features/shell/components/dashboard-panel";
import { NavIcon } from "@/features/shell/components/nav-icons";
import { apiClient } from "@/lib/api-client";
import { notifyApiError } from "@/lib/notify";

import { planKeys } from "../api/plan-queries";
import type { PlanInsight, PlanOverview, PlanState, PlanTimelinePoint } from "../types";
import { formatPlanDay } from "../utils/plan-dates";

const STATE_LABEL: Record<PlanState, string> = {
  active: "In progress",
  upcoming: "Upcoming",
  finished: "Finished",
  empty: "No days yet",
};

const STATE_COLOR: Record<PlanState, string> = {
  active: "teal",
  upcoming: "blue",
  finished: "gray",
  empty: "gray",
};

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function shortDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * How plans are going. Boards measure work by status; plans are measured by days: what is planned
 * for today, how each day went, which days were left unfinished and where each plan stands.
 */
export function PlansOverview({ data }: { data: PlanOverview }) {
  const { totals } = data;
  return (
    <DashboardGrid label="Plans overview">
      <DashboardPanel title="Overview" description="All plans at a glance" icon={<NavIcon name="plans" />}>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
          <Tile label="Plans" value={totals.plans} />
          <Tile label="In progress" value={totals.active_plans} accent="today" />
          <Tile label="Days planned" value={totals.days} />
          <Tile label="Items done" value={`${totals.completed}/${totals.items}`} accent="complete" />
          <Tile label="Completion" value={percent(totals.completion_rate)} accent="complete" />
          <Tile
            label="Unfinished on past days"
            value={totals.missed_items}
            accent={totals.missed_items ? "danger" : undefined}
          />
        </div>
      </DashboardPanel>

      <DashboardPanel
        title="Today"
        description={formatPlanDay(data.today)}
        icon={<NavIcon name="today" />}
        count={totals.today_total}
      >
        <TodayList data={data} />
      </DashboardPanel>

      <DashboardPanel
        title="Daily progress"
        description="Items done out of items planned, last two weeks and the week ahead"
        icon={<NavIcon name="schedule" />}
      >
        <DailyChart points={data.timeline} today={data.today} />
      </DashboardPanel>

      <DashboardPanel
        title="Plan progress"
        description="Where each plan stands"
        icon={<NavIcon name="plans" />}
        count={data.plans.length}
        empty={data.plans.length === 0 ? <PanelEmpty>No plans yet</PanelEmpty> : undefined}
      >
        <ul className="space-y-1">
          {data.plans.map((plan) => (
            <li key={plan.id}>
              <PlanRow plan={plan} />
            </li>
          ))}
        </ul>
      </DashboardPanel>
    </DashboardGrid>
  );
}

function Tile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: "danger" | "today" | "complete";
}) {
  const box =
    accent === "danger"
      ? "border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10"
      : accent === "today"
        ? "border-[var(--app-primary)]/30 bg-[var(--app-primary)]/8"
        : accent === "complete"
          ? "border-teal-200 bg-teal-50 dark:border-teal-500/30 dark:bg-teal-500/10"
          : "border-[var(--app-border)] bg-[var(--app-surface-muted)]";
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${box}`}>
      <p className="truncate text-xs font-medium text-[var(--app-text-muted)]">{label}</p>
      <p className="mt-1 font-display text-xl text-[var(--app-text)]">{value}</p>
    </div>
  );
}

function TodayList({ data }: { data: PlanOverview }) {
  const queryClient = useQueryClient();
  const toggle = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      apiClient.updatePlanItem(id, { is_completed: done }),
    onMutate: async ({ id, done }) => {
      // Update the overview right away; the server response refreshes the numbers.
      const key = [...planKeys.overview, data.today] as const;
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<PlanOverview>(key);
      queryClient.setQueryData<PlanOverview>(key, (current) =>
        current
          ? {
              ...current,
              today_items: current.today_items.map((item) =>
                item.id === id ? { ...item, is_completed: done } : item,
              ),
            }
          : current,
      );
      return { previous, key };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(context.key, context.previous);
      notifyApiError(error, "Could not update the item");
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: planKeys.all }),
  });

  if (!data.today_items.length && !data.behind.length) {
    return <PanelEmpty>Nothing planned for today.</PanelEmpty>;
  }
  return (
    <div className="space-y-4">
      {data.today_items.length ? (
        <ul className="space-y-1" aria-label="Planned for today">
          {data.today_items.map((item) => (
            <li key={item.id} className="flex items-start gap-2 rounded-md px-1 py-1 hover:bg-[var(--app-surface-muted)]">
              <Checkbox
                size="xs"
                mt={3}
                checked={item.is_completed}
                aria-label={item.title}
                onChange={(event) => toggle.mutate({ id: item.id, done: event.currentTarget.checked })}
              />
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm ${
                    item.is_completed ? "text-[var(--app-text-muted)] line-through" : "text-[var(--app-text)]"
                  }`}
                >
                  {item.title}
                </p>
                <Link href={`/plans/${item.plan_id}`} className="text-xs text-[var(--app-text-muted)] hover:underline">
                  {item.plan_name}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[var(--app-text-muted)]">Nothing planned for today.</p>
      )}
      {data.behind.length ? (
        <div>
          <p className="mb-1 text-xs font-medium text-[var(--app-text-muted)]">Left unfinished</p>
          <ul className="space-y-1" aria-label="Past days with unfinished items">
            {data.behind.map((day) => (
              <li key={day.day_id}>
                <Link
                  href={`/plans/${day.plan_id}`}
                  className="flex items-center justify-between gap-2 rounded-md px-1 py-1 text-sm hover:bg-[var(--app-surface-muted)]"
                >
                  <span className="min-w-0 truncate">
                    {day.plan_name} · {shortDate(day.day)}
                  </span>
                  <span className="shrink-0 text-xs text-rose-700 dark:text-rose-300">
                    {day.open_items} of {day.total_items} open
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** One bar per day: a neutral track for what was planned, filled by what got done. */
function DailyChart({ points, today }: { points: PlanTimelinePoint[]; today: string }) {
  const max = Math.max(1, ...points.map((point) => point.planned));
  const hasData = points.some((point) => point.planned > 0);
  const todayIndex = points.findIndex((point) => point.day === today);
  if (!hasData) return <PanelEmpty>No items planned in this period.</PanelEmpty>;

  return (
    <div className="flex h-full min-h-[11rem] flex-col">
      <div className="flex items-center gap-4 text-xs text-[var(--app-text-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-slate-200 dark:bg-slate-700" aria-hidden /> Planned
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-teal-600 dark:bg-teal-400" aria-hidden /> Done
        </span>
      </div>
      <div className="mt-3 flex min-h-0 flex-1 items-end gap-[2px] border-b border-[var(--app-border)]" aria-hidden>
        {points.map((point) => {
          const isToday = point.day === today;
          const future = point.day > today;
          return (
            <Tooltip
              key={point.day}
              withinPortal
              label={`${shortDate(point.day)}${isToday ? " (today)" : ""}: ${point.completed} of ${point.planned} done`}
            >
              {/* Hit target spans the full column height, larger than the bar itself. */}
              <div className="flex h-full min-w-0 flex-1 items-end justify-center px-[1px]">
                <div
                  className={`relative w-full max-w-[1.5rem] overflow-hidden rounded-t ${
                    future ? "bg-slate-100 dark:bg-slate-800" : "bg-slate-200 dark:bg-slate-700"
                  } ${isToday ? "ring-2 ring-[var(--app-primary)] ring-offset-1 ring-offset-[var(--app-surface)]" : ""}`}
                  style={{ height: `${point.planned ? Math.max((point.planned / max) * 100, 6) : 0}%` }}
                >
                  <div
                    className="absolute inset-x-0 bottom-0 bg-teal-600 dark:bg-teal-400"
                    style={{ height: `${point.planned ? (point.completed / point.planned) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </Tooltip>
          );
        })}
      </div>
      <div className="relative mt-1 h-4 text-[11px] text-[var(--app-text-muted)]" aria-hidden>
        <span className="absolute left-0">{shortDate(points[0].day)}</span>
        {todayIndex >= 0 ? (
          <span
            className="absolute -translate-x-1/2 font-medium text-[var(--app-primary)]"
            style={{ left: `${((todayIndex + 0.5) / points.length) * 100}%` }}
          >
            Today
          </span>
        ) : null}
        <span className="absolute right-0">{shortDate(points[points.length - 1].day)}</span>
      </div>
      <table className="sr-only">
        <caption>Items done out of items planned per day</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Planned</th>
            <th>Done</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.day}>
              <td>{point.day}</td>
              <td>{point.planned}</td>
              <td>{point.completed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlanRow({ plan }: { plan: PlanInsight }) {
  const detail =
    plan.state === "upcoming" && plan.first_day
      ? `Starts ${shortDate(plan.first_day)}`
      : plan.state === "active"
        ? `${plan.days_left} ${plan.days_left === 1 ? "day" : "days"} left`
        : plan.state === "finished" && plan.last_day
          ? `Ended ${shortDate(plan.last_day)}`
          : "Add days to get started";
  return (
    <Link
      href={`/plans/${plan.id}`}
      className="block rounded-lg px-1.5 py-2 hover:bg-[var(--app-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--app-primary)]"
    >
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--app-text)]">{plan.name}</p>
        <Badge size="xs" variant="light" color={STATE_COLOR[plan.state]}>
          {STATE_LABEL[plan.state]}
        </Badge>
        <span className="shrink-0 text-xs tabular-nums text-[var(--app-text-muted)]">
          {plan.completed_count}/{plan.item_count}
        </span>
      </div>
      <Progress
        value={plan.completion_rate * 100}
        mt={6}
        size="sm"
        color="teal"
        aria-label={`${plan.name} ${percent(plan.completion_rate)} complete`}
      />
      <p className="mt-1 flex justify-between text-xs text-[var(--app-text-muted)]">
        <span>{detail}</span>
        {plan.missed_items ? (
          <span className="text-rose-700 dark:text-rose-300">{plan.missed_items} unfinished on past days</span>
        ) : null}
      </p>
    </Link>
  );
}
