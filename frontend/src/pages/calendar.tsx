import { CalendarPage } from "@/features/calendar/components/calendar-page";
import { getWorkspaceLayout } from "@/features/shell/components/workspace-layout";
import type { PageWithLayout } from "@/lib/page-layout";

const CalendarRoute: PageWithLayout = () => <CalendarPage />;

CalendarRoute.getLayout = getWorkspaceLayout;

export default CalendarRoute;
