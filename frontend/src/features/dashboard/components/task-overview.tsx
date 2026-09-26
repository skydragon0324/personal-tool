"use client";

import { Button, Loader, SegmentedControl, Select, Table, Text, TextInput } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { useAuth } from "@/features/auth/components/auth-provider";
import { AssigneeAvatars } from "@/features/board/components/assignee-avatars";
import { boardColorClass } from "@/features/board/utils/board-icons";
import { statusHeaderClass } from "@/features/board/utils/status-colors";
import { PriorityBadge } from "@/features/tasks/components/priority-badge";
import { apiClient } from "@/lib/api-client";
import { formatDisplayDate, todayISO } from "@/lib/dates";

import { dashboardKeys } from "../hooks/use-dashboard";
import type { DashboardTaskRow } from "../types";
import {
  DUE_BUCKET_LABELS,
  dueBucket,
  filterRows,
  sortRows,
  type DueBucket,
  type TaskRowFilters,
  type TaskSort,
} from "../utils/task-rows";

type State = "open" | "done" | "all";

const EMPTY_FILTERS: TaskRowFilters = { boardId: "", assigneeId: "", priority: "", query: "", bucket: "" };

const BUCKET_STYLE: Record<DueBucket, string> = {
  overdue: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200",
  today: "border-[var(--app-primary)]/30 bg-[var(--app-primary)]/8 text-[var(--app-text)]",
  week: "border-[var(--app-border)] bg-[var(--app-surface-muted)] text-[var(--app-text)]",
  later: "border-[var(--app-border)] bg-[var(--app-surface-muted)] text-[var(--app-text)]",
  done: "border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-200",
};

/** Every task across your boards with where it is, who has it and when it is due. */
export function TaskOverview() {
  const router = useRouter();
  const { user } = useAuth();
  const today = todayISO();
  const [state, setState] = useState<State>("open");
  const [filters, setFilters] = useState<TaskRowFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<TaskSort>("due");
  const tasksQuery = useQuery({
    queryKey: [...dashboardKeys.all, "tasks", state] as const,
    queryFn: () => apiClient.getDashboardTasks({ state }),
  });
  const rows = useMemo(() => tasksQuery.data?.items ?? [], [tasksQuery.data]);

  const boards = useMemo(() => {
    const seen = new Map<string, string>();
    rows.forEach((row) => seen.set(row.board_id, row.board_name));
    return [...seen].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);
  const people = useMemo(() => {
    const seen = new Map<string, string>();
    rows.forEach((row) => row.assignees.forEach((person) => seen.set(person.id, person.display_name)));
    return [...seen]
      .filter(([id]) => id !== user?.id)
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rows, user?.id]);

  // Bucket counts ignore the bucket filter itself so the chips always show the full picture.
  const unbucketed = useMemo(() => filterRows(rows, { ...filters, bucket: "" }, today), [filters, rows, today]);
  const counts = useMemo(() => {
    const result: Record<DueBucket, number> = { overdue: 0, today: 0, week: 0, later: 0, done: 0 };
    unbucketed.forEach((row) => {
      result[dueBucket(row, today)] += 1;
    });
    return result;
  }, [today, unbucketed]);
  const visible = useMemo(
    () => sortRows(filterRows(rows, filters, today), sort),
    [filters, rows, sort, today],
  );
  const buckets: DueBucket[] =
    state === "done" ? ["done"] : state === "all" ? ["overdue", "today", "week", "later", "done"] : ["overdue", "today", "week", "later"];
  const filtered = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

  function set<K extends keyof TaskRowFilters>(key: K, value: TaskRowFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <section
      aria-label="Tasks"
      className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg text-[var(--app-text)]">Tasks</h2>
          <p className="mt-1 text-sm text-[var(--app-text-muted)]">
            Every task across your boards: where it is, who has it and when it is due.
          </p>
        </div>
        <SegmentedControl
          size="xs"
          value={state}
          onChange={(value) => {
            setState(value as State);
            set("bucket", "");
          }}
          data={[
            { value: "open", label: "Open" },
            { value: "done", label: "Completed" },
            { value: "all", label: "All" },
          ]}
        />
      </header>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter by due date">
        {buckets.map((bucket) => (
          <button
            key={bucket}
            type="button"
            aria-pressed={filters.bucket === bucket}
            onClick={() => set("bucket", filters.bucket === bucket ? "" : bucket)}
            className={`rounded-xl border px-3 py-1.5 text-left transition ${BUCKET_STYLE[bucket]} ${
              filters.bucket === bucket ? "ring-2 ring-[var(--app-primary)]" : "hover:brightness-95"
            }`}
          >
            <span className="block text-[11px] font-medium opacity-80">{DUE_BUCKET_LABELS[bucket]}</span>
            <span className="font-display text-lg leading-tight">{counts[bucket]}</span>
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_12rem_12rem_9rem_10rem_auto]">
        <TextInput
          size="xs"
          placeholder="Search title, board or category"
          aria-label="Search tasks"
          value={filters.query}
          onChange={(event) => set("query", event.currentTarget.value)}
        />
        <Select
          size="xs"
          aria-label="Board"
          placeholder="All boards"
          data={[{ value: "", label: "All boards" }, ...boards]}
          value={filters.boardId}
          onChange={(value) => set("boardId", value ?? "")}
        />
        <Select
          size="xs"
          aria-label="Assignee"
          placeholder="Anyone"
          data={[
            { value: "", label: "Anyone" },
            ...(user ? [{ value: user.id, label: "Assigned to me" }] : []),
            { value: "unassigned", label: "Unassigned" },
            ...people,
          ]}
          value={filters.assigneeId}
          onChange={(value) => set("assigneeId", value ?? "")}
        />
        <Select
          size="xs"
          aria-label="Priority"
          placeholder="Any priority"
          data={[
            { value: "", label: "Any priority" },
            { value: "high", label: "High" },
            { value: "medium", label: "Medium" },
            { value: "low", label: "Low" },
          ]}
          value={filters.priority}
          onChange={(value) => set("priority", value ?? "")}
        />
        <Select
          size="xs"
          aria-label="Sort by"
          data={[
            { value: "due", label: "Sort: due date" },
            { value: "priority", label: "Sort: priority" },
            { value: "board", label: "Sort: board" },
            { value: "updated", label: "Sort: recently updated" },
          ]}
          value={sort}
          onChange={(value) => setSort((value as TaskSort) ?? "due")}
          allowDeselect={false}
        />
        <Button size="xs" variant="default" disabled={!filtered} onClick={() => setFilters(EMPTY_FILTERS)}>
          Clear
        </Button>
      </div>

      <div className="mt-3 max-h-[32rem] overflow-auto rounded-xl border border-[var(--app-border)]">
        {tasksQuery.isLoading ? (
          <div className="flex justify-center py-10">
            <Loader size="sm" />
          </div>
        ) : visible.length === 0 ? (
          <Text size="sm" c="dimmed" ta="center" py="xl">
            {rows.length === 0 ? "No tasks here yet." : "No tasks match these filters."}
          </Text>
        ) : (
          <Table stickyHeader highlightOnHover verticalSpacing={6} fz="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Task</Table.Th>
                <Table.Th>Board</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Assignee</Table.Th>
                <Table.Th>Priority</Table.Th>
                <Table.Th>Due</Table.Th>
                <Table.Th>Sub-tasks</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {visible.map((row) => (
                <TaskRow
                  key={row.id}
                  row={row}
                  today={today}
                  onOpen={() => router.push(`/boards/${row.board_id}?task=${row.id}`)}
                />
              ))}
            </Table.Tbody>
          </Table>
        )}
      </div>
      <Text size="xs" c="dimmed" mt={6}>
        Showing {visible.length} of {rows.length}
        {tasksQuery.data?.truncated ? " (only the first 1000 are loaded)" : ""}. Click a task to open it.
      </Text>
    </section>
  );
}

function TaskRow({
  row,
  today,
  onOpen,
}: {
  row: DashboardTaskRow;
  today: string;
  onOpen: () => void;
}) {
  const bucket = dueBucket(row, today);
  const dueClass =
    bucket === "overdue"
      ? "text-rose-600 dark:text-rose-300 font-medium"
      : bucket === "today"
        ? "text-[var(--app-primary)] font-medium"
        : "text-[var(--app-text-muted)]";
  return (
    <Table.Tr
      className="cursor-pointer"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter") onOpen();
      }}
    >
      <Table.Td className="max-w-[22rem]">
        <p className={`truncate font-medium ${row.is_done ? "text-[var(--app-text-muted)] line-through" : ""}`}>
          {row.title}
        </p>
        <p className="truncate text-xs text-[var(--app-text-muted)]">
          {row.category_name}
          {row.is_recurring ? " · repeats" : ""}
        </p>
      </Table.Td>
      <Table.Td>
        <span className="inline-flex max-w-[12rem] items-center gap-1.5">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${boardColorClass(row.board_color)}`} aria-hidden />
          <span className="truncate">{row.board_name}</span>
        </span>
      </Table.Td>
      <Table.Td>
        <span className="inline-flex max-w-[10rem] items-center gap-1.5">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusHeaderClass(row.status_color)}`} aria-hidden />
          <span className="truncate">{row.status_name}</span>
        </span>
      </Table.Td>
      <Table.Td>
        {row.assignees.length ? (
          <AssigneeAvatars people={row.assignees} size={24} max={4} />
        ) : (
          <span className="text-[var(--app-text-muted)]">—</span>
        )}
      </Table.Td>
      <Table.Td>
        <PriorityBadge priority={row.priority} />
      </Table.Td>
      <Table.Td className={`whitespace-nowrap ${dueClass}`}>
        {bucket === "overdue" ? "Overdue · " : bucket === "today" ? "Today · " : ""}
        {formatDisplayDate(row.due_date)}
      </Table.Td>
      <Table.Td className="whitespace-nowrap text-[var(--app-text-muted)]">
        {row.subtask_total ? `${row.subtask_completed}/${row.subtask_total}` : "—"}
      </Table.Td>
    </Table.Tr>
  );
}
