"use client";

import { useState } from "react";
import Link from "next/link";

import { PriorityBadge } from "@/features/tasks/components/priority-badge";
import { formatDisplayDate } from "@/lib/dates";

import type { DashboardAttentionItem } from "../types";

export function AttentionList({
  empty,
  items,
}: {
  empty: string;
  items: DashboardAttentionItem[];
}) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-[var(--app-text-muted)]">{empty}</p>;
  }

  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={`/boards/${item.board_id}?task=${item.id}`}
            className="block rounded-lg px-2 py-2 hover:bg-[var(--app-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--app-primary)]"
          >
            <div className="flex items-start gap-2">
              <p className="min-w-0 flex-1 truncate font-medium text-[var(--app-text)]">{item.title}</p>
              <PriorityBadge priority={item.priority} />
            </div>
            <p className="mt-1 truncate text-xs text-[var(--app-text-muted)]">
              {item.board_name}
              {" · "}
              {item.status_name}
              {" · "}
              {formatDisplayDate(item.due_date)}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function AttentionTabs({
  overdue,
  dueToday,
}: {
  overdue: DashboardAttentionItem[];
  dueToday: DashboardAttentionItem[];
}) {
  const [tab, setTab] = useState<"overdue" | "due_today">("overdue");
  const items = tab === "overdue" ? overdue : dueToday;

  return (
    <div>
      <div role="tablist" aria-label="Attention lists" className="mb-3 flex gap-1 rounded-lg bg-[var(--app-surface-muted)] p-1">
        <TabButton
          selected={tab === "overdue"}
          onClick={() => setTab("overdue")}
          label="Overdue"
          count={overdue.length}
        />
        <TabButton
          selected={tab === "due_today"}
          onClick={() => setTab("due_today")}
          label="Due today"
          count={dueToday.length}
        />
      </div>
      <div role="tabpanel">
        <AttentionList
          empty={tab === "overdue" ? "No overdue tasks." : "Nothing due today."}
          items={items}
        />
      </div>
    </div>
  );
}

function TabButton({
  selected,
  onClick,
  label,
  count,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={`flex-1 rounded-md px-2 py-1.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--app-primary)] ${
        selected
          ? "bg-[var(--app-surface)] text-[var(--app-text)] shadow-sm"
          : "text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
      }`}
    >
      {label}
      <span className="ml-1.5 text-xs">{count}</span>
    </button>
  );
}
