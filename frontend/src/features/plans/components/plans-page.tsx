import { ActionIcon, Button, Group, Loader, Menu, Progress, Text } from "@mantine/core";
import Link from "next/link";
import { useRouter } from "@/lib/navigation";
import { useEffect, useState } from "react";

import { PageHeader } from "@/features/shell/components/page-header";
import { todayISO } from "@/lib/dates";
import { notifyApiError } from "@/lib/notify";

import { usePlanMutations, usePlans, usePlansOverview } from "../hooks/use-plans";
import type { PlanSummary } from "../types";
import { formatPlanRange } from "../utils/plan-dates";
import { ConfirmDeleteDialog, PlanFormModal } from "./plan-dialogs";
import { PlansOverview } from "./plans-overview";
import { t } from "@/i18n";

export function PlansPage() {
  const router = useRouter();
  const plansQuery = usePlans();
  const overviewQuery = usePlansOverview(todayISO());
  const { create, update, remove } = usePlanMutations();
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<PlanSummary | null>(null);
  const [deleting, setDeleting] = useState<PlanSummary | null>(null);
  const plans = plansQuery.data ?? [];

  useEffect(() => {
    document.title = "Plans · Life Management";
    return () => {
      document.title = "Life Management";
    };
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title={t("shell.plans")} description={t("plans.pageDescription")}>
        <Button onClick={() => setCreating(true)}>{t("plans.newPlan")}</Button>
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-[1400px] space-y-4 px-4 py-5 sm:px-6">
          {plansQuery.isLoading ? (
            <Group justify="center" py="xl">
              <Loader />
            </Group>
          ) : null}
          {plansQuery.isError ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <Text>{t("plans.couldNotLoad")}</Text>
              <Button variant="light" onClick={() => void plansQuery.refetch()}>
                {t("common.retry")}
              </Button>
            </div>
          ) : null}
          {plansQuery.isSuccess && plans.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <h2 className="font-display text-2xl text-[var(--app-text)]">{t("plans.noPlans")}</h2>
              <Text c="dimmed" maw={420}>
                {t("plans.noPlansHint")}
              </Text>
              <Button onClick={() => setCreating(true)}>{t("plans.createPlan")}</Button>
            </div>
          ) : null}
          {plans.length > 0 && overviewQuery.data ? <PlansOverview data={overviewQuery.data} /> : null}
          {plans.length > 0 ? (
            <h2 className="pt-2 font-display text-lg text-[var(--app-text)]">{t("plans.allPlans")}</h2>
          ) : null}
          {plans.length > 0 ? (
            <ul aria-label={t("plans.yourPlans")} className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {plans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  onRename={() => setRenaming(plan)}
                  onDelete={() => setDeleting(plan)}
                />
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <PlanFormModal
        opened={creating}
        title={t("plans.newPlan")}
        submitLabel={t("plans.createPlan")}
        submitting={create.isPending}
        onClose={() => setCreating(false)}
        onSubmit={async (payload) => {
          try {
            const plan = await create.mutateAsync(payload);
            setCreating(false);
            router.push(`/plans/${plan.id}`);
          } catch (error) {
            notifyApiError(error, t("plans.couldNotCreate"));
          }
        }}
      />
      <PlanFormModal
        opened={renaming !== null}
        title={t("plans.renamePlan")}
        submitLabel={t("common.save")}
        initial={renaming ? { name: renaming.name, description: renaming.description } : undefined}
        submitting={update.isPending}
        onClose={() => setRenaming(null)}
        onSubmit={async (payload) => {
          if (!renaming) return;
          try {
            await update.mutateAsync({ planId: renaming.id, payload });
            setRenaming(null);
          } catch (error) {
            notifyApiError(error, t("plans.couldNotRename"));
          }
        }}
      />
      <ConfirmDeleteDialog
        opened={deleting !== null}
        title={t("plans.deletePlanTitle")}
        message={t("plans.deletePlanBody", { name: deleting?.name ?? "" })}
        submitting={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await remove.mutateAsync(deleting.id);
            setDeleting(null);
          } catch (error) {
            notifyApiError(error, t("plans.couldNotDelete"));
          }
        }}
      />
    </div>
  );
}

function PlanCard({
  plan,
  onRename,
  onDelete,
}: {
  plan: PlanSummary;
  onRename: () => void;
  onDelete: () => void;
}) {
  const range = formatPlanRange(plan.first_day, plan.last_day);
  const percent = plan.item_count ? Math.round((plan.completed_count / plan.item_count) * 100) : 0;

  return (
    <li className="relative rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-sm transition hover:shadow-md">
      <Link
        href={`/plans/${plan.id}`}
        className="block rounded-xl p-4 pr-11 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--app-primary)]"
      >
        <h2 className="truncate font-medium text-[var(--app-text)]">{plan.name}</h2>
        {plan.description ? (
          <p className="mt-0.5 line-clamp-2 text-xs text-[var(--app-text-muted)]">{plan.description}</p>
        ) : null}
        <p className="mt-2 text-xs text-[var(--app-text-muted)]">
          {t("plans.dayCount", { count: plan.day_count })}
          {range ? ` · ${range}` : ""}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <Progress value={percent} size="sm" className="flex-1" aria-label={t("plans.planProgressLabel", { name: plan.name })} />
          <span className="text-xs tabular-nums text-[var(--app-text-muted)]">
            {plan.completed_count}/{plan.item_count}
          </span>
        </div>
      </Link>
      <div className="absolute right-2 top-2">
        <Menu shadow="md" position="bottom-end" withinPortal>
          <Menu.Target>
            <ActionIcon variant="subtle" color="gray" size="sm" aria-label={t("plans.menuFor", { name: plan.name })}>
              ⋯
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={onRename}>{t("plans.rename")}</Menu.Item>
            <Menu.Item color="red" onClick={onDelete}>
              {t("common.delete")}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </div>
    </li>
  );
}
