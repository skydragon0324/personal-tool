"use client";

import { Button, Loader, Progress, Text } from "@mantine/core";
import Link from "next/link";
import { useEffect } from "react";

import { PriorityBadge } from "@/features/tasks/components/priority-badge";
import { BoardGlyph, boardColorClass } from "@/features/board/utils/board-icons";
import { PageHeader } from "@/features/shell/components/page-header";
import { useWorkspaceChrome } from "@/features/shell/components/workspace-chrome";
import { formatDisplayDate } from "@/lib/dates";

import { useDashboardSummary } from "../hooks/use-dashboard";
import type { DashboardAttentionItem, DashboardBoardStats, DashboardSummary } from "../types";

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function BoardsDashboardPage() {
  const chrome = useWorkspaceChrome();
  const summaryQuery = useDashboardSummary();

  useEffect(() => {
    document.title = "Boards · Life Management";
    return () => {
      document.title = "Life Management";
    };
  }, []);

  const data = summaryQuery.data;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Boards">
        <Button onClick={() => chrome?.openNewBoard()}>New board</Button>
        <Button variant="light" onClick={() => chrome?.openManageBoards()}>
          Manage boards
        </Button>
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-[1400px] space-y-8 px-4 py-5 sm:px-6">
          {summaryQuery.isLoading ? (
            <div className="flex justify-center py-16">
              <Loader />
            </div>
          ) : null}
          {summaryQuery.isError ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <Text>Could not load dashboard.</Text>
              <Button variant="light" onClick={() => void summaryQuery.refetch()}>
                Retry
              </Button>
            </div>
          ) : null}
          {data && data.active_boards === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <h2 className="font-display text-2xl text-[var(--app-text)]">No boards yet</h2>
              <Text c="dimmed" maw={420}>
                Create a board to start tracking tasks across your life.
              </Text>
              <Button onClick={() => chrome?.openNewBoard()}>New board</Button>
            </div>
          ) : null}
          {data && data.active_boards > 0 ? <DashboardBody data={data} /> : null}
        </div>
      </div>
    </div>
  );
}

function DashboardBody({ data }: { data: DashboardSummary }) {
  return (
    <>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
        <StatCard label="Active boards" value={data.active_boards} />
        <StatCard label="Total tasks" value={data.total_tasks} />
        <StatCard label="Open tasks" value={data.open_tasks} />
        <StatCard label="Completed tasks" value={data.completed_tasks} />
        <StatCard label="Completion rate" value={percent(data.completion_rate)} />
        <StatCard label="Overdue" value={data.overdue} />
        <StatCard label="Due today" value={data.due_today} />
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl text-[var(--app-text)]">Progress by board</h2>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {data.boards.map((board) => (
            <BoardProgressCard key={board.id} board={board} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl text-[var(--app-text)]">Priority distribution</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="High" value={data.priority.high} />
          <StatCard label="Medium" value={data.priority.medium} />
          <StatCard label="Low" value={data.priority.low} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl text-[var(--app-text)]">Needs attention</h2>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <AttentionList heading="Overdue tasks" empty="No overdue tasks." items={data.attention.overdue} />
          <AttentionList heading="Tasks due today" empty="Nothing due today." items={data.attention.due_today} />
        </div>
      </section>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--app-text-muted)]">{label}</p>
      <p className="mt-2 font-display text-2xl text-[var(--app-text)]">{value}</p>
    </div>
  );
}

function BoardProgressCard({ board }: { board: DashboardBoardStats }) {
  return (
    <Link
      href={`/boards/${board.id}`}
      className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 hover:border-[var(--app-primary)]/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--app-primary)]"
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl text-white ${boardColorClass(board.color)}`}
        >
          <BoardGlyph name={board.icon_name} size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium text-[var(--app-text)]">{board.name}</h3>
          <p className="text-xs text-[var(--app-text-muted)]">
            {board.status_count} statuses · {percent(board.completion_rate)} complete
          </p>
        </div>
      </div>
      <Progress value={board.completion_rate * 100} mt="md" />
      <dl className="mt-3 grid grid-cols-3 gap-2 text-sm sm:grid-cols-6">
        <Metric label="Total" value={board.total} />
        <Metric label="Open" value={board.open} />
        <Metric label="Completed" value={board.completed} />
        <Metric label="Overdue" value={board.overdue} />
        <Metric label="Due today" value={board.due_today} />
        <Metric label="Statuses" value={board.status_count} />
      </dl>
    </Link>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs text-[var(--app-text-muted)]">{label}</dt>
      <dd className="font-medium text-[var(--app-text)]">{value}</dd>
    </div>
  );
}

function AttentionList({
  heading,
  empty,
  items,
}: {
  heading: string;
  empty: string;
  items: DashboardAttentionItem[];
}) {
  return (
    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
      <h3 className="text-sm font-medium text-[var(--app-text-muted)]">{heading}</h3>
      {items.length === 0 ? (
        <Text size="sm" c="dimmed" mt="sm">
          {empty}
        </Text>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg bg-[var(--app-surface-muted)] px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/boards/${item.board_id}?task=${item.id}`}
                  className="font-medium text-[var(--app-text)] hover:text-[var(--app-primary)]"
                >
                  {item.title}
                </Link>
                <PriorityBadge priority={item.priority} />
              </div>
              <p className="mt-1 text-xs text-[var(--app-text-muted)]">
                <Link href={`/boards/${item.board_id}`} className="hover:text-[var(--app-text)]">
                  {item.board_name}
                </Link>
                {" · "}
                {item.status_name}
                {" · "}
                {formatDisplayDate(item.due_date)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
