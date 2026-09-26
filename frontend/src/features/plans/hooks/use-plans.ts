"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api-client";
import { notifyApiError } from "@/lib/notify";

import { planKeys } from "../api/plan-queries";
import type {
  PlanCreate,
  PlanDayCreate,
  PlanDayUpdate,
  PlanDetail,
  PlanItemUpdate,
  PlanSummary,
  PlanUpdate,
} from "../types";
import {
  patchItem,
  removeDay,
  removeItem,
  replaceInList,
  summaryFromDetail,
  upsertDay,
  upsertItem,
} from "../utils/plan-cache";

export function usePlans() {
  return useQuery({
    queryKey: planKeys.list,
    queryFn: () => apiClient.listPlans(),
  });
}

/** Progress across all plans, relative to the viewer's local date. */
export function usePlansOverview(today: string) {
  return useQuery({
    queryKey: [...planKeys.overview, today] as const,
    queryFn: () => apiClient.getPlansOverview(today),
  });
}

export function usePlan(planId: string) {
  return useQuery({
    queryKey: planKeys.detail(planId),
    queryFn: () => apiClient.getPlan(planId),
  });
}

/** Create, rename and delete plans. */
export function usePlanMutations() {
  const queryClient = useQueryClient();

  function store(plan: PlanDetail) {
    queryClient.setQueryData(planKeys.detail(plan.id), plan);
    queryClient.setQueryData<PlanSummary[]>(planKeys.list, (list) =>
      replaceInList(list, summaryFromDetail(plan)),
    );
  }

  const refreshList = () => {
    void queryClient.invalidateQueries({ queryKey: planKeys.list });
    void queryClient.invalidateQueries({ queryKey: planKeys.overview });
  };

  const create = useMutation({
    mutationFn: (payload: PlanCreate) => apiClient.createPlan(payload),
    onSuccess: store,
    onSettled: refreshList,
  });

  const update = useMutation({
    mutationFn: ({ planId, payload }: { planId: string; payload: PlanUpdate }) =>
      apiClient.updatePlan(planId, payload),
    onSuccess: store,
    onSettled: refreshList,
  });

  const remove = useMutation({
    mutationFn: (planId: string) => apiClient.deletePlan(planId),
    onSuccess: (_result, planId) => {
      queryClient.setQueryData<PlanSummary[]>(planKeys.list, (list) =>
        list?.filter((entry) => entry.id !== planId),
      );
      queryClient.removeQueries({ queryKey: planKeys.detail(planId) });
    },
    onSettled: refreshList,
  });

  return { create, update, remove };
}

type DetailContext = { previous?: PlanDetail };

/**
 * Day and item edits inside one plan. Checkbox toggles and deletes are optimistic so the UI
 * updates immediately; failures roll back and show an error.
 */
export function usePlanDetailMutations(planId: string) {
  const queryClient = useQueryClient();
  const key = planKeys.detail(planId);

  function apply(update: (plan: PlanDetail) => PlanDetail) {
    const current = queryClient.getQueryData<PlanDetail>(key);
    if (!current) return;
    const next = update(current);
    queryClient.setQueryData(key, next);
    queryClient.setQueryData<PlanSummary[]>(planKeys.list, (list) =>
      replaceInList(list, summaryFromDetail(next)),
    );
  }

  async function optimistic(update: (plan: PlanDetail) => PlanDetail): Promise<DetailContext> {
    await queryClient.cancelQueries({ queryKey: key });
    const previous = queryClient.getQueryData<PlanDetail>(key);
    apply(update);
    return { previous };
  }

  function rollback(fallback: string) {
    return (error: unknown, _vars: unknown, context?: DetailContext) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      notifyApiError(error, fallback);
    };
  }

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: key });
    void queryClient.invalidateQueries({ queryKey: planKeys.list });
    void queryClient.invalidateQueries({ queryKey: planKeys.overview });
  }

  const addDay = useMutation({
    mutationFn: (payload: PlanDayCreate) => apiClient.createPlanDay(planId, payload),
    onSuccess: (day) => apply((plan) => upsertDay(plan, day)),
    onSettled: refresh,
  });

  const updateDay = useMutation({
    mutationFn: ({ dayId, payload }: { dayId: string; payload: PlanDayUpdate }) =>
      apiClient.updatePlanDay(dayId, payload),
    onSuccess: (day) => apply((plan) => upsertDay(plan, day)),
    onSettled: refresh,
  });

  const deleteDay = useMutation({
    mutationFn: (dayId: string) => apiClient.deletePlanDay(dayId),
    onMutate: (dayId: string) => optimistic((plan) => removeDay(plan, dayId)),
    onError: rollback("Could not delete the day"),
    onSettled: refresh,
  });

  const addItem = useMutation({
    mutationFn: ({ dayId, title }: { dayId: string; title: string }) =>
      apiClient.createPlanItem(dayId, { title }),
    onSuccess: (item) => apply((plan) => upsertItem(plan, item)),
    onSettled: refresh,
  });

  const updateItem = useMutation({
    mutationFn: ({ itemId, payload }: { itemId: string; payload: PlanItemUpdate }) =>
      apiClient.updatePlanItem(itemId, payload),
    onMutate: ({ itemId, payload }) => optimistic((plan) => patchItem(plan, itemId, payload)),
    onError: rollback("Could not update the item"),
    onSettled: refresh,
  });

  const deleteItem = useMutation({
    mutationFn: (itemId: string) => apiClient.deletePlanItem(itemId),
    onMutate: (itemId: string) => optimistic((plan) => removeItem(plan, itemId)),
    onError: rollback("Could not delete the item"),
    onSettled: refresh,
  });

  return { addDay, updateDay, deleteDay, addItem, updateItem, deleteItem };
}
