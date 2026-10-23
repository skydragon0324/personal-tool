import { NotepadPage } from "@/features/notepad/components/notepad-page";
import { getWorkspaceLayout } from "@/features/shell/components/workspace-layout";
import type { PageWithLayout } from "@/lib/page-layout";

const NotepadRoute: PageWithLayout = () => <NotepadPage />;

NotepadRoute.getLayout = getWorkspaceLayout;

export default NotepadRoute;
