import { PlansPage } from "@/features/plans/components/plans-page";
import { getWorkspaceLayout } from "@/features/shell/components/workspace-layout";
import type { PageWithLayout } from "@/lib/page-layout";

const PlansRoute: PageWithLayout = () => <PlansPage />;

PlansRoute.getLayout = getWorkspaceLayout;

export default PlansRoute;
