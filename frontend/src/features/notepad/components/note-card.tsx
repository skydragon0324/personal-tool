"use client";

import { ActionIcon, Menu } from "@mantine/core";

import { PriorityBadge } from "@/features/tasks/components/priority-badge";
import { formatDateTime } from "@/lib/dates";

import type { Note } from "../types";

interface NoteCardProps {
  note: Note;
  pinning?: boolean;
  onOpen: (note: Note) => void;
  onTogglePin: (note: Note) => void;
  onDelete: (note: Note) => void;
}

export function NoteCard({ note, pinning, onOpen, onTogglePin, onDelete }: NoteCardProps) {
  return (
    <article
      className="flex min-h-[10.5rem] cursor-pointer flex-col rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-sm transition hover:border-[var(--app-primary)]/40"
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("[data-note-actions]")) return;
        onOpen(note);
      }}
    >
      <div className="flex items-start gap-2">
        <h2 className="min-w-0 flex-1 truncate font-medium text-[var(--app-text)]">{note.title}</h2>
        {note.is_pinned ? (
          <span className="mt-0.5 shrink-0 text-[var(--app-primary)]" title="Pinned" aria-label="Pinned">
            <PinIcon filled />
          </span>
        ) : null}
        <NoteActionsMenu
          pinned={note.is_pinned}
          pinning={pinning}
          onTogglePin={() => onTogglePin(note)}
          onDelete={() => onDelete(note)}
        />
      </div>
      <p className="mt-2 min-h-[2.5rem] flex-1 whitespace-pre-wrap break-words text-sm text-[var(--app-text-muted)] line-clamp-2">
        {note.body.trim() || "No additional text"}
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
    </article>
  );
}

export function NoteActionsMenu({
  pinned,
  pinning,
  onTogglePin,
  onDelete,
}: {
  pinned: boolean;
  pinning?: boolean;
  onTogglePin: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      data-note-actions
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <Menu shadow="md" width={160} position="bottom-end" withinPortal={false}>
        <Menu.Target>
          <ActionIcon variant="subtle" color="gray" aria-label="Note actions" disabled={pinning}>
            <MoreIcon />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item
            disabled={pinning}
            onClick={(event) => {
              event.stopPropagation();
              onTogglePin();
            }}
          >
            {pinned ? "Unpin" : "Pin"}
          </Menu.Item>
          <Menu.Item
            color="red"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
          >
            Delete
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </div>
  );
}

function MoreIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

function PinIcon({ filled }: { filled?: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} aria-hidden>
      <path
        d="M15 4.5 19.5 9c.4.4.4 1 0 1.4l-3.1 3.1 1.2 5.3-5.3-1.2L9 20.7 3.3 15l3.1-3.1-1.2-5.3 5.3 1.2L13.6 4.5c.4-.4 1-.4 1.4 0Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
