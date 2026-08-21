"use client";

import { Button, Group, Modal, Text } from "@mantine/core";
import { useMemo, useState } from "react";

import { TaskDetailDrawer } from "@/features/tasks/components/task-detail-drawer";
import { DeleteTaskDialog } from "@/features/tasks/components/delete-task-dialog";
import { RecurrenceScopeDialog } from "@/features/tasks/components/recurrence-scope-dialog";
import { useColumns } from "@/features/board/hooks/use-columns";
import { useTaskMutations } from "@/features/board/hooks/use-task-mutations";
import type { BoardColumn, BoardQueryParams, TaskCreate, TaskDetail } from "@/features/board/types";
import { NoteDrawer } from "@/features/notepad/components/note-drawer";
import { DeleteNoteDialog } from "@/features/notepad/components/delete-note-dialog";
import { useNoteMutations } from "@/features/notepad/hooks/use-notes";
import type { Note, NoteCreate, NoteUpdate } from "@/features/notepad/types";
import { ScheduleModal } from "@/features/schedule/components/schedule-modal";
import { useScheduleMutations } from "@/features/schedule/hooks/use-schedule";
import type { ScheduleEntry, ScheduleEntryCreate } from "@/features/schedule/types";
import { mondayOf } from "@/features/schedule/utils/schedule-time";
import { apiClient } from "@/lib/api-client";
import { todayISO } from "@/lib/dates";

import type { TodaySchedule } from "../types";

export function TodayTaskDrawer({
  taskId,
  boardId,
  onClose,
}: {
  taskId: string | null;
  boardId: string | null;
  onClose: () => void;
}) {
  const today = todayISO();
  const query: BoardQueryParams = {
    boardId: boardId ?? "",
    startDate: today,
    endDate: today,
    dateField: "due_date",
    unbounded: true,
  };
  const columnsQuery = useColumns(boardId ?? "", false);
  const { update, remove, stopRecurrence, uploadAttachment, deleteAttachment } = useTaskMutations(query);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [deleting, setDeleting] = useState<{
    id: string;
    title: string;
    repeating?: boolean;
    completed?: boolean;
  } | null>(null);

  const columns: BoardColumn[] = useMemo(
    () =>
      (columnsQuery.data ?? []).map((column) => ({
        ...column,
        tasks: [],
      })),
    [columnsQuery.data],
  );

  async function handleSubmit(payload: TaskCreate, pendingFiles: File[], existingId?: string): Promise<TaskDetail> {
    const taskIdToUse = existingId ?? taskId;
    if (!taskIdToUse) throw new Error("Task is not loaded");
    const saved = await update.mutateAsync({
      taskId: taskIdToUse,
      payload: {
        title: payload.title,
        description: payload.description,
        content: payload.content,
        start_date: payload.start_date,
        due_date: payload.due_date,
        priority: payload.priority,
        category_id: payload.category_id,
        links: payload.links,
        edit_scope: payload.edit_scope,
        recurrence: payload.recurrence,
      },
    });
    for (const file of pendingFiles) {
      await uploadAttachment.mutateAsync({ taskId: saved.id, file });
    }
    return saved;
  }

  return (
    <>
      <TaskDetailDrawer
        taskId={taskId}
        mode={mode}
        boardId={boardId ?? ""}
        query={query}
        columns={columns}
        submitting={update.isPending}
        onModeChange={setMode}
        onClose={() => {
          setMode("view");
          onClose();
        }}
        onSubmit={handleSubmit}
        onUploadFile={(id, file) => uploadAttachment.mutateAsync({ taskId: id, file })}
        onPatchContent={async (id, content) => {
          await update.mutateAsync({ taskId: id, payload: { content } });
        }}
        onDeleteAttachment={(attachmentId) => {
          if (!taskId) return Promise.resolve();
          return deleteAttachment.mutateAsync({ taskId, attachmentId });
        }}
        onDelete={(id, title, meta) =>
          setDeleting({
            id,
            title,
            repeating: Boolean(meta?.repeating),
            completed: Boolean(meta?.completed),
          })
        }
        onStopRepeat={async (seriesId) => {
          await stopRecurrence.mutateAsync(seriesId);
        }}
      />
      {deleting?.repeating ? (
        <RecurrenceScopeDialog
          open
          mode="delete"
          taskTitle={deleting.title}
          completed={Boolean(deleting.completed)}
          submitting={remove.isPending}
          onClose={() => setDeleting(null)}
          onConfirm={async (scope, confirmCompleted) => {
            await remove.mutateAsync({
              taskId: deleting.id,
              deleteScope: scope,
              confirmCompleted: Boolean(confirmCompleted || deleting.completed),
            });
            setDeleting(null);
            onClose();
          }}
        />
      ) : (
        <DeleteTaskDialog
          open={deleting !== null}
          taskTitle={deleting?.title ?? ""}
          submitting={remove.isPending}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            if (!deleting) return;
            await remove.mutateAsync({ taskId: deleting.id });
            setDeleting(null);
            onClose();
          }}
        />
      )}
    </>
  );
}

export function TodayNoteDrawer({
  note,
  onClose,
}: {
  note: Note | null;
  onClose: () => void;
}) {
  const mutations = useNoteMutations();
  const [pendingDelete, setPendingDelete] = useState<Note | null>(null);

  async function handleCreate(payload: NoteCreate) {
    await mutations.create.mutateAsync(payload);
    onClose();
  }

  async function handleUpdate(noteId: string, payload: NoteUpdate) {
    await mutations.update.mutateAsync({ noteId, payload });
    onClose();
  }

  return (
    <>
      <NoteDrawer
        opened={note !== null}
        note={note}
        submitting={mutations.create.isPending || mutations.update.isPending}
        onClose={onClose}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onDelete={setPendingDelete}
      />
      <DeleteNoteDialog
        noteTitle={pendingDelete?.title ?? null}
        submitting={mutations.remove.isPending}
        onClose={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (!pendingDelete) return;
          await mutations.remove.mutateAsync(pendingDelete.id);
          setPendingDelete(null);
          onClose();
        }}
      />
    </>
  );
}

export function TodayScheduleEditor({
  entry,
  weekStart,
  selectedDate,
  onClose,
}: {
  entry: TodaySchedule | null;
  weekStart: string;
  selectedDate: string;
  onClose: () => void;
}) {
  const mutations = useScheduleMutations(weekStart, selectedDate);
  const [pendingDelete, setPendingDelete] = useState<ScheduleEntry | null>(null);
  const mapped: ScheduleEntry | null = entry
    ? {
        id: entry.id,
        title: entry.title,
        kind: entry.kind,
        weekdays: entry.weekdays,
        week_start: entry.week_start,
        start_time: entry.start_time,
        end_time: entry.end_time,
        priority: entry.priority,
        color: entry.color,
        notes: entry.notes,
        created_at: "",
        updated_at: "",
      }
    : null;

  async function handleUpdate(entryId: string, payload: ScheduleEntryCreate) {
    await mutations.update.mutateAsync({
      entryId,
      payload: {
        ...payload,
        week_start: payload.kind === "this_week" ? mondayOf(selectedDate) : null,
      },
    });
    onClose();
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    await mutations.remove.mutateAsync(pendingDelete.id);
    setPendingDelete(null);
    onClose();
  }

  return (
    <>
      <ScheduleModal
        opened={entry !== null}
        entry={mapped}
        weekStart={weekStart}
        submitting={mutations.update.isPending}
        onClose={onClose}
        onCreate={async () => undefined}
        onUpdate={handleUpdate}
        onDelete={setPendingDelete}
      />
      <Modal
        opened={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Delete this schedule?"
        radius="lg"
      >
        <Text size="sm" c="dimmed">
          “{pendingDelete?.title}” will be permanently removed.
        </Text>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setPendingDelete(null)}>
            Cancel
          </Button>
          <Button color="red" onClick={() => void handleDelete()} loading={mutations.remove.isPending}>
            Delete
          </Button>
        </Group>
      </Modal>
    </>
  );
}

export async function loadNote(noteId: string): Promise<Note> {
  return apiClient.getNote(noteId);
}
