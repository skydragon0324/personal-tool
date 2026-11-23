import { MyTasksPage } from "@/features/dashboard/components/workspace-pages";
import { getWorkspaceLayout } from "@/features/shell/components/workspace-layout";
import type { PageWithLayout } from "@/lib/page-layout";

const MyTasksRoute: PageWithLayout = () => <MyTasksPage />;

MyTasksRoute.getLayout = getWorkspaceLayout;

export default MyTasksRoute;
