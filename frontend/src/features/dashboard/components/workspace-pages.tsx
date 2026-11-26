import { Button, Loader, Text } from "@mantine/core";
import { useEffect } from "react";

import { PageHeader } from "@/features/shell/components/page-header";
import { t } from "@/i18n";

import { DashboardBody } from "./boards-dashboard-page";
import { TaskOverview } from "./task-overview";
import { useDashboardSummary } from "../hooks/use-dashboard";

function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · ${t("common.appName")}`;
    return () => {
      document.title = t("common.appName");
    };
  }, [title]);
}

export function MyTasksPage() {
  usePageTitle(t("shell.myTasks"));
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title={t("shell.myTasks")} description={t("workspace.myTasksHint")} />
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-[1480px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          <TaskOverview mineOnly />
        </div>
      </div>
    </div>
  );
}

export function ReportsPage() {
  usePageTitle(t("shell.reports"));
  const summary = useDashboardSummary();
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title={t("shell.reports")} description={t("workspace.reportsHint")} />
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-[1480px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          {summary.isLoading ? (
            <div className="flex justify-center py-16">
              <Loader />
            </div>
          ) : null}
          {summary.isError ? (
            <div className="py-16 text-center">
              <Text mb="sm">{t("workspace.couldNotLoad")}</Text>
              <Button variant="light" onClick={() => void summary.refetch()}>
                {t("common.retry")}
              </Button>
            </div>
          ) : null}
          {summary.data ? <DashboardBody data={summary.data} /> : null}
        </div>
      </div>
    </div>
  );
}
