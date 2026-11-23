import { InboxPage } from "@/features/inbox/components/inbox-page";
import { getWorkspaceLayout } from "@/features/shell/components/workspace-layout";
import type { PageWithLayout } from "@/lib/page-layout";

const InboxRoute: PageWithLayout = () => <InboxPage />;

InboxRoute.getLayout = getWorkspaceLayout;

export default InboxRoute;
