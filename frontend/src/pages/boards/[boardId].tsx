import { useRouter } from "next/router";

import { BoardPage } from "@/features/board/components/board-page";
import { getWorkspaceLayout } from "@/features/shell/components/workspace-layout";
import { todayISO } from "@/lib/dates";
import type { PageWithLayout } from "@/lib/page-layout";

const BoardRoute: PageWithLayout = () => {
  const { query, isReady } = useRouter();
  const boardId = typeof query.boardId === "string" ? query.boardId : null;
  // The route param is only known after hydration on a statically optimized page.
  if (!isReady || !boardId) return null;
  return <BoardPage key={boardId} boardId={boardId} initialDate={todayISO()} />;
};

BoardRoute.getLayout = getWorkspaceLayout;

export default BoardRoute;
