import { BoardsDashboardPage } from "@/features/dashboard/components/boards-dashboard-page";
import { getWorkspaceLayout } from "@/features/shell/components/workspace-layout";
import type { PageWithLayout } from "@/lib/page-layout";

const BoardsIndexPage: PageWithLayout = () => <BoardsDashboardPage />;

BoardsIndexPage.getLayout = getWorkspaceLayout;

export default BoardsIndexPage;
