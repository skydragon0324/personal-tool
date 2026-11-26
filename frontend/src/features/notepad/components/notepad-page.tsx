import { Button, Group, Loader, SegmentedControl, Select, Text, TextInput } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/features/shell/components/page-header";
import { apiClient } from "@/lib/api-client";
import { useRouter } from "@/lib/navigation";
import { notifyApiError } from "@/lib/notify";

import { noteKeys } from "../api/note-queries";

import { useNoteMutations, useNotes } from "../hooks/use-notes";
import type { Note, NoteCreate, NotePriority, NoteUpdate } from "../types";
import { readNotepadView, writeNotepadView, type NotepadView } from "../utils/notepad-view";
import { DeleteNoteDialog } from "./delete-note-dialog";
import { NoteCard } from "./note-card";
import { NoteModal } from "./note-modal";
import { NoteTable } from "./note-table";
import { t } from "@/i18n";

function priorityFilters() {
  return [
    { value: "all", label: t("notes.allPriorities") },
    { value: "high", label: t("task.priorityHigh") },
    { value: "medium", label: t("task.priorityMedium") },
    { value: "low", label: t("task.priorityLow") },
  ];
}

export function NotepadPage() {
  const [search, setSearch] = useState("");
  const [query] = useDebouncedValue(search.trim(), 250);
  const [priority, setPriority] = useState<NotePriority | "all">("all");
  const [view, setView] = useState<NotepadView>("cards");
  const [viewReady, setViewReady] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Note | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();
  const noteParam = typeof router.query.note === "string" ? router.query.note : null;
  const newParam = router.query.new === "1";

  // Links such as search results open a note (`?note=<id>`); `?new=1` starts a new one.
  // The query is cleared afterwards so closing the note does not reopen it.
  useEffect(() => {
    if (!router.isReady || (!noteParam && !newParam)) return;
    void router.replace("/notepad", undefined, { shallow: true });
    if (newParam) {
      setEditing(null);
      setEditorOpen(true);
      return;
    }
    if (!noteParam) return;
    queryClient
      .fetchQuery({ queryKey: noteKeys.detail(noteParam), queryFn: () => apiClient.getNote(noteParam) })
      .then((note) => {
        setEditing(note);
        setEditorOpen(true);
      })
      .catch((error: unknown) => notifyApiError(error, t("notes.couldNotLoad")));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per link, not when router changes identity
  }, [router.isReady, noteParam, newParam]);

  useEffect(() => {
    document.title = "Notepad · Task Management";
    setView(readNotepadView(window.localStorage));
    setViewReady(true);
    return () => {
      document.title = "Task Management";
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
    setEditorOpen(true);
  }

  function openEdit(note: Note) {
    setEditing(note);
    setEditorOpen(true);
  }

  async function handleCreate(payload: NoteCreate) {
    try {
      await mutations.create.mutateAsync(payload);
      setEditorOpen(false);
      setEditing(null);
    } catch (error) {
      notifyApiError(error, t("notes.couldNotCreate"));
    }
  }

  async function handleUpdate(noteId: string, payload: NoteUpdate) {
    try {
      await mutations.update.mutateAsync({ noteId, payload });
      setEditorOpen(false);
      setEditing(null);
    } catch (error) {
      notifyApiError(error, t("notes.couldNotUpdate"));
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
        setEditorOpen(false);
        setEditing(null);
      }
      setPendingDelete(null);
    } catch (error) {
      notifyApiError(error, t("notes.couldNotDelete"));
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title={t("shell.notepad")}>
        {viewReady ? (
          <SegmentedControl
            value={view}
            onChange={(value) => changeView(value as NotepadView)}
            data={[
              { value: "cards", label: t("notes.cards") },
              { value: "table", label: t("notes.table") },
            ]}
          />
        ) : (
          <div className="h-9 w-[148px]" />
        )}
        <Button onClick={openCreate}>{t("notes.newNote")}</Button>
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-[1400px] space-y-4 px-4 py-5 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <TextInput
              className="min-w-[16rem] flex-1"
              placeholder={t("notes.search")}
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              aria-label={t("notes.searchLabel")}
            />
            <Select
              aria-label={t("notes.priorityFilter")}
              data={priorityFilters()}
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
              <Text>{t("notes.couldNotLoad")}</Text>
              <Button variant="light" onClick={() => void notesQuery.refetch()}>
                {t("common.retry")}
              </Button>
            </div>
          ) : null}
          {empty ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <h2 className="font-display text-2xl text-[var(--app-text)]">{t("notes.noNotes")}</h2>
              <Text c="dimmed" maw={420}>
                {t("notes.noNotesHint")}
              </Text>
              <Button onClick={openCreate}>{t("notes.createNote")}</Button>
            </div>
          ) : null}
          {!notesQuery.isLoading && !notesQuery.isError && !empty && notes.length === 0 ? (
            <Text c="dimmed" py="xl" ta="center">
              {t("notes.noMatches")}
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

      <NoteModal
        opened={editorOpen}
        note={editing}
        submitting={mutations.create.isPending || mutations.update.isPending}
        onClose={() => {
          setEditorOpen(false);
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
