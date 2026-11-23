import { ActionIcon, Button, Loader, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { ChevronLeftIcon, ChevronRightIcon } from "@/features/board/components/board-ui-icons";
import { boardColorClass } from "@/features/board/utils/board-icons";
import { formatMonthLabel, monthRange, parseISODate, toISODate } from "@/features/board/utils/date-presets";
import { dashboardKeys } from "@/features/dashboard/hooks/use-dashboard";
import type { DashboardTaskRow } from "@/features/dashboard/types";
import { PageHeader } from "@/features/shell/components/page-header";
import { apiClient } from "@/lib/api-client";
import { todayISO } from "@/lib/dates";
import { useRouter } from "@/lib/navigation";
import { dateLocale, t } from "@/i18n";

/** Six Monday-first weeks that contain the month of `monthStart`. */
export function calendarDays(monthStart: string): string[] {
  const first = parseISODate(monthStart);
  const offset = (first.getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) =>
    toISODate(new Date(first.getFullYear(), first.getMonth(), 1 - offset + index)),
  );
}

function shiftMonth(monthStart: string, by: number): string {
  const date = parseISODate(monthStart);
  return toISODate(new Date(date.getFullYear(), date.getMonth() + by, 1));
}

export function CalendarPage() {
  const router = useRouter();
  const today = todayISO();
  const [month, setMonth] = useState(() => monthRange(today)[0] as string);
  const tasks = useQuery({
    queryKey: [...dashboardKeys.all, "tasks", "all"] as const,
    queryFn: () => apiClient.getDashboardTasks({ state: "all" }),
  });

  useEffect(() => {
    document.title = `${t("shell.calendar")} · ${t("common.appName")}`;
    return () => {
      document.title = t("common.appName");
    };
  }, []);

  const byDay = useMemo(() => {
    const map = new Map<string, DashboardTaskRow[]>();
    (tasks.data?.items ?? []).forEach((row) => map.set(row.due_date, [...(map.get(row.due_date) ?? []), row]));
    return map;
  }, [tasks.data]);
  const days = useMemo(() => calendarDays(month), [month]);
  const monthPrefix = month.slice(0, 7);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title={t("shell.calendar")} description={t("workspace.calendarHint")}>
        <Button variant="default" onClick={() => setMonth(monthRange(today)[0] as string)}>
          {t("workspace.thisMonth")}
        </Button>
        <div className="flex items-center gap-1">
          <ActionIcon variant="default" size="lg" aria-label={t("workspace.previousMonth")} onClick={() => setMonth(shiftMonth(month, -1))}>
            <ChevronLeftIcon />
          </ActionIcon>
          <span className="min-w-[10rem] text-center font-semibold text-[var(--app-text)]" aria-live="polite">
            {formatMonthLabel(month)}
          </span>
          <ActionIcon variant="default" size="lg" aria-label={t("workspace.nextMonth")} onClick={() => setMonth(shiftMonth(month, 1))}>
            <ChevronRightIcon />
          </ActionIcon>
        </div>
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-auto p-4 sm:px-6 lg:px-8">
        {tasks.isLoading ? (
          <div className="flex justify-center py-16">
            <Loader />
          </div>
        ) : tasks.isError ? (
          <div className="py-16 text-center">
            <Text mb="sm">{t("workspace.couldNotLoad")}</Text>
            <Button variant="light" onClick={() => void tasks.refetch()}>
              {t("common.retry")}
            </Button>
          </div>
        ) : (
          <div className="flex h-full min-h-[38rem] min-w-[52rem] flex-col overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)]">
            <div className="grid shrink-0 grid-cols-7 border-b border-[var(--app-border)] bg-[var(--app-surface-muted)]">
              {days.slice(0, 7).map((day) => (
                <div key={day} className="px-2 py-2 text-center text-xs font-semibold text-[var(--app-text-muted)]">
                  {parseISODate(day).toLocaleDateString(dateLocale(), { weekday: "short" })}
                </div>
              ))}
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6">
              {days.map((day) => {
                const items = byDay.get(day) ?? [];
                const inMonth = day.startsWith(monthPrefix);
                return (
                  <div
                    key={day}
                    className={`flex min-h-0 min-w-0 flex-col gap-1 border-b border-r border-[var(--app-border)] p-1.5 ${
                      inMonth ? "" : "bg-[var(--app-surface-muted)] opacity-60"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        day === today ? "bg-[var(--app-primary)] text-white dark:text-[var(--app-bg)]" : "text-[var(--app-text-muted)]"
                      }`}
                    >
                      {parseISODate(day).getDate()}
                    </span>
                    <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
                      {items.map((row) => (
                        <button
                          key={row.id}
                          type="button"
                          title={`${row.title} · ${row.board_name}`}
                          onClick={() => router.push(`/boards/${row.board_id}?task=${row.id}`)}
                          className="flex shrink-0 items-center gap-1.5 rounded-md bg-[var(--app-surface-muted)] px-1.5 py-0.5 text-left text-xs text-[var(--app-text)] hover:bg-[var(--app-primary-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--app-primary)]"
                        >
                          <span aria-hidden className={`h-2 w-2 shrink-0 rounded-sm ${boardColorClass(row.board_color)}`} />
                          <span className={`truncate ${row.is_done ? "text-[var(--app-text-muted)] line-through" : ""}`}>
                            {row.title}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
