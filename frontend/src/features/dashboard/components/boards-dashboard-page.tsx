"use client";

import { Button, Loader, Progress, Text } from "@mantine/core";
import Link from "next/link";
import { useEffect } from "react";

import { BoardGlyph, boardColorClass } from "@/features/board/utils/board-icons";
import { DashboardGrid, DashboardPanel, PanelEmpty } from "@/features/shell/components/dashboard-panel";
import { NavIcon } from "@/features/shell/components/nav-icons";
import { PageHeader } from "@/features/shell/components/page-header";
import { useWorkspaceChrome } from "@/features/shell/components/workspace-chrome";

import { AttentionTabs } from "./attention-list";
import { useDashboardSummary } from "../hooks/use-dashboard";
import type { DashboardBoardStats, DashboardSummary } from "../types";

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
        <Button variant="light" component={Link} href="/boards/recurring">
          Recurring tasks
        </Button>
        <Button onClick={() => chrome?.openNewBoard()}>New board</Button>
        <Button variant="light" onClick={() => chrome?.openManageBoards()}>
          Manage boards
        </Button>
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-[1400px] space-y-4 px-4 py-5 sm:px-6">
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
    <DashboardGrid label="Boards dashboard">
      <DashboardPanel
        title="Overview"
        description="A snapshot of work across your boards"
        icon={<NavIcon name="boards" />}
        count={data.active_boards}
      >
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
          <MetricTile label="Active boards" value={data.active_boards} />
          <MetricTile label="Total tasks" value={data.total_tasks} />
          <MetricTile label="Open" value={data.open_tasks} />
          <MetricTile label="Completed" value={data.completed_tasks} accent="complete" />
          <MetricTile label="Completion rate" value={percent(data.completion_rate)} accent="complete" />
          <MetricTile label="Due today" value={data.due_today} accent="today" />
          <MetricTile label="Overdue" value={data.overdue} accent="danger" />
        </div>
      </DashboardPanel>

      <DashboardPanel
        title="Board progress"
        description="Completion by board"
        icon={<NavIcon name="boards" />}
        count={data.boards.length}
        empty={
          data.boards.length === 0 ? <PanelEmpty>No boards yet</PanelEmpty> : undefined
        }
      >
        <ul className="space-y-1">
          {data.boards.map((board) => (
            <li key={board.id}>
              <BoardProgressRow board={board} />
            </li>
          ))}
        </ul>
      </DashboardPanel>

      <DashboardPanel
        title="Workload"
        description="Priority mix and completion"
        icon={<NavIcon name="today" />}
      >
        <WorkloadPanel data={data} />
      </DashboardPanel>

      <DashboardPanel
        title="Needs attention"
        description="Overdue and due today"
        icon={<NavIcon name="schedule" />}
        count={data.attention.overdue.length + data.attention.due_today.length}
      >
        <AttentionTabs overdue={data.attention.overdue} dueToday={data.attention.due_today} />
      </DashboardPanel>
    </DashboardGrid>
  );
}

function MetricTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: "danger" | "today" | "complete";
}) {
  const accentClass =
    accent === "danger"
      ? "border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10"
      : accent === "today"
        ? "border-[var(--app-primary)]/30 bg-[var(--app-primary)]/8"
        : accent === "complete"
          ? "border-teal-200 bg-teal-50 dark:border-teal-500/30 dark:bg-teal-500/10"
          : "border-[var(--app-border)] bg-[var(--app-surface-muted)]";
  const valueClass =
    accent === "danger"
      ? "text-rose-700 dark:text-rose-300"
      : accent === "complete"
        ? "text-teal-700 dark:text-teal-300"
        : "text-[var(--app-text)]";

  return (
    <div className={`rounded-xl border px-3 py-2.5 ${accentClass}`}>
      <p className="truncate text-xs font-medium text-[var(--app-text-muted)]">{label}</p>
      <p className={`mt-1 font-display text-xl ${valueClass}`}>{value}</p>
    </div>
  );
}

function BoardProgressRow({ board }: { board: DashboardBoardStats }) {
  return (
    <Link
      href={`/boards/${board.id}`}
      className="flex items-center gap-3 rounded-lg px-1.5 py-2 hover:bg-[var(--app-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--app-primary)]"
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white ${boardColorClass(board.color)}`}
      >
        <BoardGlyph name={board.icon_name} size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--app-text)]">{board.name}</p>
          <p className="shrink-0 text-xs text-[var(--app-text-muted)]">
            {board.completed}/{board.total}
          </p>
          {board.overdue > 0 ? (
            <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-800 dark:bg-rose-500/20 dark:text-rose-200">
              {board.overdue} overdue
            </span>
          ) : null}
        </div>
        <Progress
          value={board.completion_rate * 100}
          mt={6}
          size="sm"
          color="teal"
          aria-label={`${board.name} ${percent(board.completion_rate)} complete`}
        />
      </div>
    </Link>
  );
}

function WorkloadPanel({ data }: { data: DashboardSummary }) {
  const priorityTotal = data.priority.high + data.priority.medium + data.priority.low || 1;
  const taskTotal = data.total_tasks || 1;

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-xs font-medium text-[var(--app-text-muted)]">Priority</p>
        <SegmentedBar
          segments={[
            { label: "High", value: data.priority.high, className: "bg-rose-500" },
            { label: "Medium", value: data.priority.medium, className: "bg-amber-400" },
            { label: "Low", value: data.priority.low, className: "bg-sky-400" },
          ]}
          total={priorityTotal}
        />
        <Legend
          items={[
            { label: "High", value: data.priority.high },
            { label: "Medium", value: data.priority.medium },
            { label: "Low", value: data.priority.low },
          ]}
        />
      </div>
      <div>
        <p className="mb-2 text-xs font-medium text-[var(--app-text-muted)]">Completion</p>
        <SegmentedBar
          segments={[
            { label: "Completed", value: data.completed_tasks, className: "bg-teal-500" },
            { label: "Open", value: data.open_tasks, className: "bg-slate-300 dark:bg-slate-600" },
          ]}
          total={taskTotal}
        />
        <Legend
          items={[
            { label: "Total", value: data.total_tasks },
            { label: "Open", value: data.open_tasks },
            { label: "Completed", value: data.completed_tasks },
          ]}
        />
      </div>
    </div>
  );
}

function SegmentedBar({
  segments,
  total,
}: {
  segments: Array<{ label: string; value: number; className: string }>;
  total: number;
}) {
  return (
    <div className="flex h-2.5 overflow-hidden rounded-full bg-[var(--app-surface-muted)]" aria-hidden>
      {segments.map((segment) => (
        <div
          key={segment.label}
          className={segment.className}
          style={{ width: `${Math.max((segment.value / total) * 100, segment.value > 0 ? 4 : 0)}%` }}
        />
      ))}
    </div>
  );
}

function Legend({ items }: { items: Array<{ label: string; value: number }> }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--app-text-muted)]">
      {items.map((item) => (
        <li key={item.label}>
          {item.label}{" "}
          <span className="font-display text-[var(--app-text)]">{item.value}</span>
        </li>
      ))}
    </ul>
  );
}
