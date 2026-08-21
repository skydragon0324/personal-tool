"use client";

import Link from "next/link";

import { PriorityBadge } from "@/features/tasks/components/priority-badge";
import { DashboardPanel, PanelEmpty } from "@/features/shell/components/dashboard-panel";
import { NavIcon } from "@/features/shell/components/nav-icons";

import type { TodayPinnedNote } from "../types";

export function TodayNotesSection({
  notes,
  total,
  onOpen,
}: {
  notes: TodayPinnedNote[];
  total: number;
  onOpen: (note: TodayPinnedNote) => void;
}) {
  return (
    <DashboardPanel
      title="Pinned notes"
      description="Notes pinned for quick reference"
      icon={<NavIcon name="notepad" />}
      count={total}
      actionHref="/notepad"
      actionLabel="View all notes"
      empty={
        notes.length === 0 ? (
          <PanelEmpty>
            <div>
              <p>Pin a note to keep it on Today.</p>
              <Link
                href="/notepad"
                className="mt-2 inline-block text-sm font-medium text-[var(--app-primary)] hover:underline"
              >
                Open notepad
              </Link>
            </div>
          </PanelEmpty>
        ) : undefined
      }
    >
      <ul className="divide-y divide-[var(--app-border)]">
        {notes.map((note) => (
          <li key={note.id}>
            <button
              type="button"
              onClick={() => onOpen(note)}
              className="flex w-full items-start gap-3 rounded-md px-1 py-2.5 text-left hover:bg-[var(--app-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--app-primary)]"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-[var(--app-text)]">{note.title}</p>
                <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-sm text-[var(--app-text-muted)]">
                  {note.preview.trim() || "No additional text"}
                </p>
              </div>
              {note.priority ? <PriorityBadge priority={note.priority} /> : null}
            </button>
          </li>
        ))}
      </ul>
    </DashboardPanel>
  );
}
