import { useRouter } from "next/router";

import { PlanDetailPage } from "@/features/plans/components/plan-detail-page";
import { getWorkspaceLayout } from "@/features/shell/components/workspace-layout";
import type { PageWithLayout } from "@/lib/page-layout";

const PlanRoute: PageWithLayout = () => {
  const { query, isReady } = useRouter();
  const planId = typeof query.planId === "string" ? query.planId : null;
  // The route param is only known after hydration on a statically optimized page.
  if (!isReady || !planId) return null;
  return <PlanDetailPage key={planId} planId={planId} />;
};

PlanRoute.getLayout = getWorkspaceLayout;

export default PlanRoute;
