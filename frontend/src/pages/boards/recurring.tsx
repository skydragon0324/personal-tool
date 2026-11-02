import { RecurringTasksPage } from "@/features/recurrence/components/recurring-tasks-page";
import { getWorkspaceLayout } from "@/features/shell/components/workspace-layout";
import type { PageWithLayout } from "@/lib/page-layout";

const RecurringTasksRoute: PageWithLayout = () => <RecurringTasksPage />;

RecurringTasksRoute.getLayout = getWorkspaceLayout;

export default RecurringTasksRoute;
