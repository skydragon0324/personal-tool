"use client";

import { Button, Group, Loader, SegmentedControl, Select, Text, TextInput } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/features/shell/components/page-header";
import { notifyApiError } from "@/lib/notify";

import { useNoteMutations, useNotes } from "../hooks/use-notes";
import type { Note, NoteCreate, NotePriority, NoteUpdate } from "../types";
import { readNotepadView, writeNotepadView, type NotepadView } from "../utils/notepad-view";
import { DeleteNoteDialog } from "./delete-note-dialog";
import { NoteCard } from "./note-card";
import { NoteDrawer } from "./note-drawer";
import { NoteTable } from "./note-table";

const PRIORITY_FILTERS = [
  { value: "all", label: "All priorities" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export function NotepadPage() {
  const [search, setSearch] = useState("");
  const [query] = useDebouncedValue(search.trim(), 250);
  const [priority, setPriority] = useState<NotePriority | "all">("all");
  const [view, setView] = useState<NotepadView>("cards");
  const [viewReady, setViewReady] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Note | null>(null);

  useEffect(() => {
    document.title = "Notepad · Life Management";
    setView(readNotepadView(window.localStorage));
    setViewReady(true);
    return () => {
      document.title = "Life Management";
    };
  }, []);

  const filters = useMemo(
    () => ({
      query: query || undefined,
      priority: priority === "all" ? undefined : priority,
    }),
    [priority, query],
  );
  const notesQuery = useNotes(filters);
  const mutations = useNoteMutations();
  const notes = notesQuery.data ?? [];
  const empty = !notesQuery.isLoading && notes.length === 0 && !query && priority === "all";

  function changeView(next: NotepadView) {
    setView(next);
    writeNotepadView(next, window.localStorage);
  }

  function openCreate() {
    setEditing(null);
    setDrawerOpen(true);
  }

  function openEdit(note: Note) {
    setEditing(note);
    setDrawerOpen(true);
  }

  async function handleCreate(payload: NoteCreate) {
    try {
      await mutations.create.mutateAsync(payload);
      setDrawerOpen(false);
      setEditing(null);
    } catch (error) {
      notifyApiError(error, "Could not create note");
    }
  }

  async function handleUpdate(noteId: string, payload: NoteUpdate) {
    try {
      await mutations.update.mutateAsync({ noteId, payload });
      setDrawerOpen(false);
      setEditing(null);
    } catch (error) {
      notifyApiError(error, "Could not update note");
    }
  }

  function handleTogglePin(note: Note) {
    if (!note.id || (mutations.pin.isPending && mutations.pin.variables?.noteId === note.id)) return;
    mutations.pin.mutate({ noteId: note.id, isPinned: !note.is_pinned });
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    try {
      await mutations.remove.mutateAsync(pendingDelete.id);
      if (editing?.id === pendingDelete.id) {
        setDrawerOpen(false);
        setEditing(null);
      }
      setPendingDelete(null);
    } catch (error) {
      notifyApiError(error, "Could not delete note");
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Notepad">
        {viewReady ? (
          <SegmentedControl
            value={view}
            onChange={(value) => changeView(value as NotepadView)}
            data={[
              { value: "cards", label: "Cards" },
              { value: "table", label: "Table" },
            ]}
          />
        ) : (
          <div className="h-9 w-[148px]" />
        )}
        <Button onClick={openCreate}>New note</Button>
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-[1400px] space-y-4 px-4 py-5 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <TextInput
              className="min-w-[16rem] flex-1"
              placeholder="Search"
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              aria-label="Search notes"
            />
            <Select
              aria-label="Priority filter"
              data={PRIORITY_FILTERS}
              value={priority}
              onChange={(value) => setPriority((value as NotePriority | "all") || "all")}
              allowDeselect={false}
              w={180}
            />
          </div>
          {notesQuery.isLoading ? (
            <Group justify="center" py="xl">
              <Loader />
            </Group>
          ) : null}
          {notesQuery.isError ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <Text>Could not load notes.</Text>
              <Button variant="light" onClick={() => void notesQuery.refetch()}>
                Retry
              </Button>
            </div>
          ) : null}
          {empty ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <h2 className="font-display text-2xl text-[var(--app-text)]">No notes yet</h2>
              <Text c="dimmed" maw={420}>
                Capture ideas, information, and anything you want to remember.
              </Text>
              <Button onClick={openCreate}>Create note</Button>
            </div>
          ) : null}
          {!notesQuery.isLoading && !notesQuery.isError && !empty && notes.length === 0 ? (
            <Text c="dimmed" py="xl" ta="center">
              No matching notes.
            </Text>
          ) : null}
          {!empty && notes.length > 0 && view === "cards" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {notes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  pinning={mutations.pin.isPending && mutations.pin.variables?.noteId === note.id}
                  onOpen={openEdit}
                  onTogglePin={handleTogglePin}
                  onDelete={setPendingDelete}
                />
              ))}
            </div>
          ) : null}
          {!empty && notes.length > 0 && view === "table" ? (
            <NoteTable
              notes={notes}
              pinningId={mutations.pin.isPending ? mutations.pin.variables?.noteId : null}
              onOpen={openEdit}
              onTogglePin={handleTogglePin}
              onDelete={setPendingDelete}
            />
          ) : null}
        </div>
      </div>

      <NoteDrawer
        opened={drawerOpen}
        note={editing}
        submitting={mutations.create.isPending || mutations.update.isPending}
        onClose={() => {
          setDrawerOpen(false);
          setEditing(null);
        }}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onDelete={setPendingDelete}
      />
      <DeleteNoteDialog
        noteTitle={pendingDelete?.title ?? null}
        submitting={mutations.remove.isPending}
        onConfirm={() => void handleDelete()}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}
