import { ActionIcon, Button, Group, Loader, Menu, Progress, Text } from "@mantine/core";
import Link from "next/link";
import { useRouter } from "@/lib/navigation";
import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/features/shell/components/page-header";
import { ApiError } from "@/lib/api-client";
import { notifyApiError } from "@/lib/notify";

import { usePlan, usePlanDetailMutations, usePlanMutations } from "../hooks/use-plans";
import type { PlanDay, PlanDayCreate } from "../types";
import { formatPlanDay, nextPlanDay } from "../utils/plan-dates";
import { ConfirmDeleteDialog, PlanDayModal, PlanFormModal } from "./plan-dialogs";
import { PlanDayCard } from "./plan-day-card";
import { t } from "@/i18n";

export function PlanDetailPage({ planId }: { planId: string }) {
  const router = useRouter();
  const planQuery = usePlan(planId);
  const plan = planQuery.data;
  const planMutations = usePlanMutations();
  const mutations = usePlanDetailMutations(planId);
  const [renaming, setRenaming] = useState(false);
  const [deletingPlan, setDeletingPlan] = useState(false);
  const [addingDay, setAddingDay] = useState(false);
  const [editingDay, setEditingDay] = useState<PlanDay | null>(null);
  const [deletingDay, setDeletingDay] = useState<PlanDay | null>(null);

  useEffect(() => {
    if (!plan) return;
    document.title = `${plan.name} · Plans · Life Management`;
    return () => {
      document.title = "Life Management";
    };
  }, [plan]);

  const takenDays = useMemo(() => plan?.days.map((day) => day.day) ?? [], [plan]);
  const newDay = useMemo<PlanDayCreate>(() => ({ day: nextPlanDay(takenDays), title: "" }), [takenDays]);

  if (planQuery.isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
    );
  }

  if (!plan) {
    const missing = planQuery.error instanceof ApiError && planQuery.error.status === 404;
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <Text>{missing ? t("plans.missing") : t("plans.couldNotLoadPlan")}</Text>
        <Group>
          {!missing ? (
            <Button variant="light" onClick={() => void planQuery.refetch()}>
              {t("common.retry")}
            </Button>
          ) : null}
          <Button component={Link} href="/plans" variant="default">
            {t("plans.backToPlans")}
          </Button>
        </Group>
      </div>
    );
  }

  const percent = plan.item_count ? Math.round((plan.completed_count / plan.item_count) * 100) : 0;

  async function saveDay(payload: PlanDayCreate) {
    try {
      if (editingDay) {
        await mutations.updateDay.mutateAsync({ dayId: editingDay.id, payload });
        setEditingDay(null);
      } else {
        await mutations.addDay.mutateAsync(payload);
        setAddingDay(false);
      }
    } catch (error) {
      notifyApiError(error, editingDay ? t("plans.couldNotUpdateDay") : t("plans.couldNotAddDay"));
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title={plan.name} description={plan.description || undefined}>
        <Button variant="default" component={Link} href="/plans">
          {t("plans.allPlans")}
        </Button>
        <Button onClick={() => setAddingDay(true)}>{t("plans.addDay")}</Button>
        <Menu shadow="md" position="bottom-end" withinPortal>
          <Menu.Target>
            <ActionIcon variant="default" size="lg" aria-label={t("plans.planMenu")}>
              ⋯
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={() => setRenaming(true)}>{t("plans.renamePlan")}</Menu.Item>
            <Menu.Item color="red" onClick={() => setDeletingPlan(true)}>
              {t("plans.deletePlan")}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-[1400px] space-y-4 px-4 py-5 sm:px-6">
          {plan.item_count > 0 ? (
            <div className="flex max-w-md items-center gap-3">
              <Progress value={percent} size="sm" className="flex-1" aria-label={t("plans.progressLabel")} />
              <span className="text-xs tabular-nums text-[var(--app-text-muted)]">
                {t("plans.doneOfTotal", { done: plan.completed_count, total: plan.item_count })}
              </span>
            </div>
          ) : null}
          {plan.days.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <h2 className="font-display text-2xl text-[var(--app-text)]">{t("plans.noDays")}</h2>
              <Text c="dimmed" maw={420}>
                {t("plans.noDaysHint")}
              </Text>
              <Button onClick={() => setAddingDay(true)}>{t("plans.addDay")}</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {plan.days.map((day) => (
                <PlanDayCard
                  key={day.id}
                  day={day}
                  onToggleItem={(item, completed) =>
                    mutations.updateItem.mutate({ itemId: item.id, payload: { is_completed: completed } })
                  }
                  onRenameItem={(item, title) =>
                    mutations.updateItem.mutate({ itemId: item.id, payload: { title } })
                  }
                  onDeleteItem={(item) => mutations.deleteItem.mutate(item.id)}
                  onAddItem={async (target, title) => {
                    try {
                      await mutations.addItem.mutateAsync({ dayId: target.id, title });
                    } catch (error) {
                      notifyApiError(error, t("plans.couldNotAddItem"));
                      throw error;
                    }
                  }}
                  onEditDay={setEditingDay}
                  onDeleteDay={setDeletingDay}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <PlanDayModal
        opened={addingDay || editingDay !== null}
        title={editingDay ? t("plans.editDay") : t("plans.addDay")}
        submitLabel={editingDay ? t("common.save") : t("plans.addDay")}
        initial={editingDay ? { day: editingDay.day, title: editingDay.title } : newDay}
        takenDays={takenDays}
        submitting={mutations.addDay.isPending || mutations.updateDay.isPending}
        onSubmit={(payload) => void saveDay(payload)}
        onClose={() => {
          setAddingDay(false);
          setEditingDay(null);
        }}
      />
      <PlanFormModal
        opened={renaming}
        title={t("plans.renamePlan")}
        submitLabel={t("common.save")}
        initial={{ name: plan.name, description: plan.description }}
        submitting={planMutations.update.isPending}
        onClose={() => setRenaming(false)}
        onSubmit={async (payload) => {
          try {
            await planMutations.update.mutateAsync({ planId, payload });
            setRenaming(false);
          } catch (error) {
            notifyApiError(error, t("plans.couldNotRename"));
          }
        }}
      />
      <ConfirmDeleteDialog
        opened={deletingPlan}
        title={t("plans.deletePlanTitle")}
        message={t("plans.deletePlanBody", { name: plan.name })}
        submitting={planMutations.remove.isPending}
        onClose={() => setDeletingPlan(false)}
        onConfirm={async () => {
          try {
            await planMutations.remove.mutateAsync(planId);
            router.push("/plans");
          } catch (error) {
            notifyApiError(error, t("plans.couldNotDelete"));
          }
        }}
      />
      <ConfirmDeleteDialog
        opened={deletingDay !== null}
        title={t("plans.deleteDayTitle")}
        message={
          deletingDay
            ? t("plans.deleteDayBody", { day: formatPlanDay(deletingDay.day), count: deletingDay.items.length })
            : ""
        }
        onClose={() => setDeletingDay(null)}
        onConfirm={() => {
          if (deletingDay) mutations.deleteDay.mutate(deletingDay.id);
          setDeletingDay(null);
        }}
      />
    </div>
  );
}
