import { BoardPage } from "@/features/board/components/board-page";

const DEFAULT_BOARD_ID =
  process.env.NEXT_PUBLIC_BOARD_ID ?? "a0000000-0000-4000-8000-000000000001";

function todayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function HomePage() {
  return <BoardPage boardId={DEFAULT_BOARD_ID} initialDate={todayISO()} />;
}
