import { SchedulePage } from "@/features/schedule/components/schedule-page";
import { getWorkspaceLayout } from "@/features/shell/components/workspace-layout";
import type { PageWithLayout } from "@/lib/page-layout";

const ScheduleRoute: PageWithLayout = () => <SchedulePage />;

ScheduleRoute.getLayout = getWorkspaceLayout;

export default ScheduleRoute;
