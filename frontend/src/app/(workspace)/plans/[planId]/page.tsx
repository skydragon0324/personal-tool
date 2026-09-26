"use client";

import { use } from "react";

import { PlanDetailPage } from "@/features/plans/components/plan-detail-page";

export default function PlanRoute({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = use(params);
  return <PlanDetailPage key={planId} planId={planId} />;
}
