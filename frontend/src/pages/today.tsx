import { TodayPage } from "@/features/today/components/today-page";
import { getWorkspaceLayout } from "@/features/shell/components/workspace-layout";
import type { PageWithLayout } from "@/lib/page-layout";

const TodayRoute: PageWithLayout = () => <TodayPage />;

TodayRoute.getLayout = getWorkspaceLayout;

export default TodayRoute;
