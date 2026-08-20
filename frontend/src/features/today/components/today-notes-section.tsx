"use client";

import { Anchor, Button, Text } from "@mantine/core";
import Link from "next/link";

import { PriorityBadge } from "@/features/tasks/components/priority-badge";
import { formatDateTime } from "@/lib/dates";

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
    <section aria-label="Pinned notes" className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl text-[var(--app-text)]">Pinned notes</h2>
        {total > notes.length ? (
          <Anchor component={Link} href="/notepad" size="sm">
            View all notes
          </Anchor>
        ) : null}
      </div>
      {notes.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <Text c="dimmed" maw={420}>
            Pin a note to keep it on Today.
          </Text>
          <Button component={Link} href="/notepad">
            Open notepad
          </Button>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => (
            <button
              key={note.id}
              type="button"
              onClick={() => onOpen(note)}
              className="flex min-h-[9rem] flex-col rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 text-left shadow-sm transition hover:border-[var(--app-primary)]/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--app-primary)]"
            >
              <h3 className="truncate font-medium text-[var(--app-text)]">{note.title}</h3>
              <p className="mt-2 min-h-[2.5rem] flex-1 whitespace-pre-wrap break-words text-sm text-[var(--app-text-muted)] line-clamp-2">
                {note.preview.trim() || "No additional text"}
              </p>
              <div className="mt-3 flex items-center justify-between gap-2">
                {note.priority ? (
                  <PriorityBadge priority={note.priority} />
                ) : (
                  <span className="text-xs text-[var(--app-text-muted)]">None</span>
                )}
                <time className="truncate text-xs text-[var(--app-text-muted)]" dateTime={note.updated_at}>
                  {formatDateTime(note.updated_at)}
                </time>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
