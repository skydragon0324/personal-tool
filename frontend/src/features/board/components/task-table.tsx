"use client";

import { Select, Table } from "@mantine/core";
import { useMemo, useState } from "react";

import { CategoryBadge } from "@/features/tasks/components/category-badge";
import { PriorityBadge } from "@/features/tasks/components/priority-badge";
import { formatTaskPeriod } from "@/lib/dates";
import type { BoardColumn, TaskSummary, TasksByColumn } from "../types";
import { flattenVisibleTasks } from "../utils/progress-stats";
import { BOARD_CONTENT_GUTTER } from "../utils/board-layout";

interface TaskTableProps {
  columns: BoardColumn[];
  tasksByColumn: TasksByColumn;
  onOpenDetail: (task: TaskSummary, mode?: "view" | "edit") => void;
  onMoveStatus: (task: TaskSummary, columnId: string) => void;
}

type SortKey = "due_date" | "priority";

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

export function TaskTable({ columns, tasksByColumn, onOpenDetail, onMoveStatus }: TaskTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("due_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const rows = useMemo(() => {
    const list = flattenVisibleTasks(columns, tasksByColumn);
    const direction = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortKey === "priority") {
        return direction * ((PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9));
      }
      return direction * a.due_date.localeCompare(b.due_date);
    });
  }, [columns, tasksByColumn, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  }

  return (
    <div className={`${BOARD_CONTENT_GUTTER} overflow-x-auto pb-8`}>
      <Table highlightOnHover striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Task</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Category</Table.Th>
            <Table.Th>
              <button type="button" className="font-semibold" onClick={() => toggleSort("priority")}>
                Priority {sortKey === "priority" ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </button>
            </Table.Th>
            <Table.Th>
              <button type="button" className="font-semibold" onClick={() => toggleSort("due_date")}>
                Dates {sortKey === "due_date" ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </button>
            </Table.Th>
            <Table.Th>Subtasks</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((task) => (
            <Table.Tr key={task.id}>
              <Table.Td>
                <button
                  type="button"
                  className="text-left font-medium text-[var(--app-text)] hover:text-[var(--app-primary)]"
                  onClick={() => onOpenDetail(task, "view")}
                >
                  {task.title}
                </button>
              </Table.Td>
              <Table.Td>
                <Select
                  data={columns.map((column) => ({ value: column.id, label: column.name }))}
                  value={task.column_id}
                  onChange={(value) => {
                    if (value) onMoveStatus(task, value);
                  }}
                  allowDeselect={false}
                  size="xs"
                />
              </Table.Td>
              <Table.Td>{task.category ? <CategoryBadge category={task.category} /> : "—"}</Table.Td>
              <Table.Td>
                <PriorityBadge priority={task.priority} />
              </Table.Td>
              <Table.Td>{formatTaskPeriod(task.start_date, task.due_date)}</Table.Td>
              <Table.Td>
                {task.subtask_total > 0
                  ? `${task.subtask_completed}/${task.subtask_total}`
                  : "—"}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {!rows.length ? (
        <p className="mt-6 text-center text-sm text-[var(--app-text-muted)]">No tasks match the current filters.</p>
      ) : null}
    </div>
  );
}
