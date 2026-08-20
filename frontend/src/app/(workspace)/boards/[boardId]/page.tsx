"use client";

import { use } from "react";

import { BoardPage } from "@/features/board/components/board-page";
import { todayISO } from "@/lib/dates";

export default function BoardRoute({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = use(params);
  return <BoardPage key={boardId} boardId={boardId} initialDate={todayISO()} />;
}
