"use client";

import { Text } from "@mantine/core";
import Link from "next/link";

import { PriorityBadge } from "@/features/tasks/components/priority-badge";
import { formatDisplayDate } from "@/lib/dates";

import type { DashboardAttentionItem } from "../types";

export function AttentionList({
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
