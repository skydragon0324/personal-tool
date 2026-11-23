import { ReportsPage } from "@/features/dashboard/components/workspace-pages";
import { getWorkspaceLayout } from "@/features/shell/components/workspace-layout";
import type { PageWithLayout } from "@/lib/page-layout";

const ReportsRoute: PageWithLayout = () => <ReportsPage />;

ReportsRoute.getLayout = getWorkspaceLayout;

export default ReportsRoute;
