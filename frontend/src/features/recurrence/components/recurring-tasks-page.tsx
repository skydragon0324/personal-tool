"use client";

import { Button, Loader, Skeleton, Text } from "@mantine/core";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { activeBoards, useBoards } from "@/features/board/hooks/use-boards";
import { PriorityBadge } from "@/features/tasks/components/priority-badge";
import { PageHeader } from "@/features/shell/components/page-header";
import { formatLongDate } from "@/lib/dates";

import { useRecurrenceSeriesList, useRecurrenceSeriesSummary } from "../hooks/use-recurrence-series";
import type {
  RecurrenceSeriesListItem,
  RecurrenceSeriesPageSize,
  RecurrenceSeriesTab,
} from "../types";
import { formatRecurrenceRule } from "../utils/format-recurrence";

const PAGE_SIZES: RecurrenceSeriesPageSize[] = [25, 50, 100];

export function RecurringTasksPage() {
  const [status, setStatus] = useState<RecurrenceSeriesTab>("active");
  const [boardId, setBoardId] = useState<string>("");
  const [limit, setLimit] = useState<RecurrenceSeriesPageSize>(25);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    document.title = "Recurring tasks · Life Management";
    return () => {
      document.title = "Life Management";
    };
  }, []);

  const boardsQuery = useBoards(true);
  const boards = activeBoards(boardsQuery.data);
  const listParams = useMemo(
    () => ({
      status,
      board_id: boardId || undefined,
      offset,
      limit,
    }),
    [boardId, limit, offset, status],
  );
  const listQuery = useRecurrenceSeriesList(listParams);
  const summary = useRecurrenceSeriesSummary(boardId || undefined);
  const data = listQuery.data;

  useEffect(() => {
    if (!data) return;
    if (data.total === 0 && offset !== 0) {
      setOffset(0);
      return;
    }
    if (data.total > 0 && offset >= data.total) {
      setOffset(Math.floor((data.total - 1) / limit) * limit);
    }
  }, [data, limit, offset]);

  function changeStatus(next: RecurrenceSeriesTab) {
    setStatus(next);
    setOffset(0);
  }

  function changeBoard(next: string) {
    setBoardId(next);
    setOffset(0);
  }

  function changeLimit(next: RecurrenceSeriesPageSize) {
    setLimit(next);
    setOffset(0);
  }

  function resetFilters() {
    setStatus("active");
    setBoardId("");
    setLimit(25);
    setOffset(0);
  }

  const loading = listQuery.isLoading || summary.isLoading;
  const failed = listQuery.isError || summary.isError;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Recurring tasks" description="Manage repeating work across your boards.">
        <Button variant="light" component={Link} href="/boards">
          Back to boards
        </Button>
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-[1400px] space-y-4 px-4 py-5 sm:px-6">
          <SummaryCards
            active={summary.activeCount}
            stopped={summary.stoppedCount}
            noFuture={summary.noFutureCount}
            loading={summary.isLoading && !summary.isError}
          />
          <FilterBar
            status={status}
            boardId={boardId}
            limit={limit}
            boards={boards.map((board) => ({ value: board.id, label: board.name }))}
            onStatusChange={changeStatus}
            onBoardChange={changeBoard}
            onLimitChange={changeLimit}
            onReset={resetFilters}
          />
          {loading ? <LoadingState /> : null}
          {failed && !loading ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <Text>Could not load recurring tasks.</Text>
              <Button
                variant="light"
                onClick={() => {
                  void listQuery.refetch();
                  summary.refetch();
                }}
              >
                Retry
              </Button>
            </div>
          ) : null}
          {!loading && !failed && data ? (
            <Results
              status={status}
              boardId={boardId}
              boardName={boards.find((board) => board.id === boardId)?.name}
              data={data}
              summaryActive={summary.activeCount}
              summaryStopped={summary.stoppedCount}
              onPrevious={() => setOffset(Math.max(0, offset - limit))}
              onNext={() => setOffset(offset + limit)}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SummaryCards({
  active,
  stopped,
  noFuture,
  loading,
}: {
  active: number;
  stopped: number;
  noFuture: number;
  loading: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" aria-label="Recurring task summary">
      <MetricCard label="Active" value={active} loading={loading} />
      <MetricCard label="Stopped" value={stopped} loading={loading} />
      <MetricCard label="No future occurrence" value={noFuture} loading={loading} />
    </div>
  );
}

function MetricCard({ label, value, loading }: { label: string; value: number; loading: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2.5">
      <p className="truncate text-xs font-medium text-[var(--app-text-muted)]">{label}</p>
      {loading ? (
        <Skeleton height={28} width={48} mt={8} />
      ) : (
        <p className="mt-1 font-display text-xl text-[var(--app-text)]">{value}</p>
      )}
    </div>
  );
}

function FilterBar({
  status,
  boardId,
  limit,
  boards,
  onStatusChange,
  onBoardChange,
  onLimitChange,
  onReset,
}: {
  status: RecurrenceSeriesTab;
  boardId: string;
  limit: RecurrenceSeriesPageSize;
  boards: Array<{ value: string; label: string }>;
  onStatusChange: (value: RecurrenceSeriesTab) => void;
  onBoardChange: (value: string) => void;
  onLimitChange: (value: RecurrenceSeriesPageSize) => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
      <div role="tablist" aria-label="Recurrence status" className="flex rounded-lg border border-[var(--app-border)] p-1">
        <TabButton selected={status === "active"} onClick={() => onStatusChange("active")}>
          Active
        </TabButton>
        <TabButton selected={status === "stopped"} onClick={() => onStatusChange("stopped")}>
          Stopped
        </TabButton>
      </div>
      <label className="block w-full sm:max-w-xs">
        <span className="mb-1 block text-sm text-[var(--app-text-muted)]">Board</span>
        <select
          aria-label="Board"
          value={boardId}
          onChange={(event) => onBoardChange(event.target.value)}
          className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)]"
        >
          <option value="">All boards</option>
          {boards.map((board) => (
            <option key={board.value} value={board.value}>
              {board.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block w-full sm:w-36">
        <span className="mb-1 block text-sm text-[var(--app-text-muted)]">Rows per page</span>
        <select
          aria-label="Rows per page"
          value={limit}
          onChange={(event) => onLimitChange(Number(event.target.value) as RecurrenceSeriesPageSize)}
          className="w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)]"
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
      <Button variant="subtle" onClick={onReset}>
        Reset filters
      </Button>
    </div>
  );
}

function TabButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--app-primary)] ${
        selected
          ? "bg-[var(--app-primary)]/15 text-[var(--app-text)]"
          : "text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
      }`}
    >
      {children}
    </button>
  );
}

function LoadingState() {
  return (
    <div role="status" aria-label="Loading recurring tasks" className="space-y-3 py-6">
      <div className="flex justify-center">
        <Loader />
      </div>
      <Skeleton height={64} radius="md" />
      <Skeleton height={64} radius="md" />
      <Skeleton height={64} radius="md" />
    </div>
  );
}

function Results({
  status,
  boardId,
  boardName,
  data,
  summaryActive,
  summaryStopped,
  onPrevious,
  onNext,
}: {
  status: RecurrenceSeriesTab;
  boardId: string;
  boardName?: string;
  data: { items: RecurrenceSeriesListItem[]; total: number; offset: number; limit: number };
  summaryActive: number;
  summaryStopped: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  if (data.total === 0) {
    return (
      <EmptyState
        status={status}
        boardId={boardId}
        boardName={boardName}
        summaryActive={summaryActive}
        summaryStopped={summaryStopped}
      />
    );
  }

  const from = data.offset + 1;
  const to = data.offset + data.items.length;
  const hasPrevious = data.offset > 0;
  const hasNext = data.offset + data.limit < data.total;

  return (
    <div className="space-y-4">
      <SeriesTable items={data.items} />
      <SeriesCards items={data.items} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Text size="sm" c="dimmed">
          Showing {from}–{to} of {data.total}
        </Text>
        <div className="flex gap-2">
          <Button variant="default" disabled={!hasPrevious} onClick={onPrevious}>
            Previous
          </Button>
          <Button variant="default" disabled={!hasNext} onClick={onNext}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  status,
  boardId,
  boardName,
  summaryActive,
  summaryStopped,
}: {
  status: RecurrenceSeriesTab;
  boardId: string;
  boardName?: string;
  summaryActive: number;
  summaryStopped: number;
}) {
  if (boardId) {
    return (
      <EmptyCopy
        title="No recurring tasks on this board"
        body={
          boardName
            ? `Nothing matches ${boardName} for the ${status} tab.`
            : "Nothing matches the selected board for this tab."
        }
      />
    );
  }
  if (summaryActive === 0 && summaryStopped === 0) {
    return (
      <EmptyCopy
        title="No recurring tasks yet"
        body="Repeating work you create on boards will appear here."
      />
    );
  }
  if (status === "active") {
    return (
      <EmptyCopy
        title="No active recurring tasks"
        body="Stopped series are on the Stopped tab."
      />
    );
  }
  return (
    <EmptyCopy
      title="No stopped recurring tasks"
      body="Active series are on the Active tab."
    />
  );
}

function EmptyCopy({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <h2 className="font-display text-2xl text-[var(--app-text)]">{title}</h2>
      <Text c="dimmed" maw={420}>
        {body}
      </Text>
    </div>
  );
}

function SeriesTable({ items }: { items: RecurrenceSeriesListItem[] }) {
  return (
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--app-border)] text-xs text-[var(--app-text-muted)]">
            <th className="py-2 pr-3 font-medium">Task</th>
            <th className="py-2 pr-3 font-medium">Board</th>
            <th className="py-2 pr-3 font-medium">Repeat</th>
            <th className="py-2 pr-3 font-medium">Next occurrence</th>
            <th className="py-2 pr-3 font-medium">Progress</th>
            <th className="py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-[var(--app-border)] align-top">
              <td className="py-3 pr-3">
                <TaskCell item={item} />
              </td>
              <td className="py-3 pr-3">
                <BoardCell item={item} />
              </td>
              <td className="py-3 pr-3 text-[var(--app-text)]">{formatRecurrenceRule(item)}</td>
              <td className="py-3 pr-3">{nextOccurrenceLabel(item)}</td>
              <td className="py-3 pr-3">
                <ProgressCounts item={item} />
              </td>
              <td className="py-3">
                <StatusBadges item={item} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SeriesCards({ items }: { items: RecurrenceSeriesListItem[] }) {
  return (
    <ul className="space-y-3 md:hidden">
      {items.map((item) => (
        <li
          key={item.id}
          className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4"
        >
          <TaskCell item={item} />
          <div className="mt-3 space-y-2 text-sm">
            <BoardCell item={item} />
            <p className="text-[var(--app-text)]">{formatRecurrenceRule(item)}</p>
            <p>{nextOccurrenceLabel(item)}</p>
            <ProgressCounts item={item} />
            <StatusBadges item={item} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function TaskCell({ item }: { item: RecurrenceSeriesListItem }) {
  return (
    <div className="min-w-0">
      <p className="font-medium text-[var(--app-text)]">{item.title}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span className="text-xs text-[var(--app-text-muted)]">{item.category_name}</span>
        <PriorityBadge priority={item.priority} />
      </div>
    </div>
  );
}

function BoardCell({ item }: { item: RecurrenceSeriesListItem }) {
  return (
    <div className="min-w-0">
      <Link
        href={`/boards/${item.board_id}`}
        className="font-medium text-[var(--app-primary)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--app-primary)]"
      >
        {item.board_name}
      </Link>
      {item.board_archived ? <StatusBadge label="Archived board" tone="archived" /> : null}
      <p className="mt-1 text-xs text-[var(--app-text-muted)]">
        {item.default_column_name || "—"}
      </p>
    </div>
  );
}

function nextOccurrenceLabel(item: RecurrenceSeriesListItem): string {
  if (item.status !== "active") return "—";
  if (!item.next_occurrence_date) return "No future occurrence";
  return formatLongDate(item.next_occurrence_date);
}

function ProgressCounts({ item }: { item: RecurrenceSeriesListItem }) {
  return (
    <p className="text-xs text-[var(--app-text-muted)]">
      Open {item.open_occurrence_count}
      {" · "}
      Completed {item.completed_occurrence_count}
      {" · "}
      Customized {item.detached_occurrence_count}
    </p>
  );
}

function StatusBadges({ item }: { item: RecurrenceSeriesListItem }) {
  return (
    <div className="flex flex-wrap gap-1">
      {item.status === "active" ? <StatusBadge label="Active" tone="active" /> : null}
      {item.status === "stopped" ? <StatusBadge label="Stopped" tone="stopped" /> : null}
      {item.status === "archived" ? <StatusBadge label="Archived" tone="archived" /> : null}
      {item.board_archived ? <StatusBadge label="Archived board" tone="archived" /> : null}
      {item.status === "active" && !item.next_occurrence_date ? (
        <StatusBadge label="No future occurrence" tone="warning" />
      ) : null}
    </div>
  );
}

function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: "active" | "stopped" | "archived" | "warning";
}) {
  const className =
    tone === "active"
      ? "bg-teal-100 text-teal-900 dark:bg-teal-500/20 dark:text-teal-100"
      : tone === "stopped"
        ? "bg-slate-100 text-slate-800 dark:bg-slate-500/25 dark:text-slate-100"
        : tone === "warning"
          ? "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100"
          : "bg-rose-100 text-rose-900 dark:bg-rose-500/20 dark:text-rose-100";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${className}`}>
      {label}
    </span>
  );
}
