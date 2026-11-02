import { Table } from "@mantine/core";

import { PriorityBadge } from "@/features/tasks/components/priority-badge";
import { formatDateTime } from "@/lib/dates";

import type { Note } from "../types";
import { NoteActionsMenu } from "./note-card";
import { t } from "@/i18n";

interface NoteTableProps {
  notes: Note[];
  pinningId?: string | null;
  onOpen: (note: Note) => void;
  onTogglePin: (note: Note) => void;
  onDelete: (note: Note) => void;
}

export function NoteTable({ notes, pinningId, onOpen, onTogglePin, onDelete }: NoteTableProps) {
  return (
    <div className="overflow-x-auto">
      <Table highlightOnHover className="min-w-[640px]">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t("notes.title")}</Table.Th>
            <Table.Th className="hidden sm:table-cell">{t("notes.preview")}</Table.Th>
            <Table.Th>{t("notes.priority")}</Table.Th>
            <Table.Th className="hidden md:table-cell">{t("notes.updated")}</Table.Th>
            <Table.Th>{t("notes.actions")}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {notes.map((note) => (
            <Table.Tr
              key={note.id}
              className="cursor-pointer"
              onClick={(event) => {
                if ((event.target as HTMLElement).closest("[data-note-actions]")) return;
                onOpen(note);
              }}
            >
              <Table.Td>
                <div className="flex min-w-[10rem] items-center gap-2">
                  {note.is_pinned ? (
                    <span className="text-[var(--app-primary)]" title={t("notes.pinned")} aria-label={t("notes.pinned")}>
                      ●
                    </span>
                  ) : null}
                  <span className="font-medium text-[var(--app-text)]">{note.title}</span>
                </div>
              </Table.Td>
              <Table.Td className="hidden max-w-md sm:table-cell">
                <p className="whitespace-pre-wrap break-words text-sm text-[var(--app-text-muted)] line-clamp-2">
                  {note.body.trim() || t("notes.noText")}
                </p>
              </Table.Td>
              <Table.Td>
                {note.priority ? (
                  <PriorityBadge priority={note.priority} />
                ) : (
                  <span className="text-sm text-[var(--app-text-muted)]">{t("notes.none")}</span>
                )}
              </Table.Td>
              <Table.Td className="hidden whitespace-nowrap text-sm text-[var(--app-text-muted)] md:table-cell">
                {formatDateTime(note.updated_at)}
              </Table.Td>
              <Table.Td>
                <NoteActionsMenu
                  pinned={note.is_pinned}
                  pinning={pinningId === note.id}
                  onTogglePin={() => onTogglePin(note)}
                  onDelete={() => onDelete(note)}
                />
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </div>
  );
}
