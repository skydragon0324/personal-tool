"use client";

import { useMemo, useState } from "react";

import { DeleteTaskDialog } from "@/features/tasks/components/delete-task-dialog";
import { TaskDialog } from "@/features/tasks/components/task-dialog";
import { formatRangeLabel, todayISO } from "@/lib/dates";
import { tasksByColumnFromView } from "../api/board-queries";
import { useBoard } from "../hooks/use-board";
import { useTaskDetail } from "../hooks/use-task-detail";
import { useTaskMutations } from "../hooks/use-task-mutations";
import type {
  TaskCreate,
  TaskDetail,
  TaskSummary,
  TasksByColumn,
} from "../types";
import { BoardSummaryCard } from "./board-summary";
import { BoardFilters, BoardToolbar } from "./board-toolbar";
import { KanbanBoard } from "./kanban-board";

interface BoardPageProps {
  boardId: string;
  initialDate: string;
}

function filterTasksByColumn(
  tasksByColumn: TasksByColumn,
  filters: BoardFilters,
): TasksByColumn {
  const query = filters.query.trim().toLowerCase();
  const next: TasksByColumn = {};

  for (const [columnId, tasks] of Object.entries(tasksByColumn)) {
    next[columnId] = tasks.filter((task) => {
      if (filters.priority && task.priority !== filters.priority) return false;
      if (query) {
        const haystack = `${task.title} ${task.content_preview}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }

  return next;
}

export function BoardPage({ boardId, initialDate }: BoardPageProps) {
  const [range, setRange] = useState<[string | null, string | null]>([
    initialDate,
    initialDate,
  ]);
  const startDate = range[0] || todayISO();
  const endDate = range[1] || range[0] || todayISO();
  const dateLabel = formatRangeLabel(startDate, endDate);

  const [filters, setFilters] = useState<BoardFilters>({
    priority: "",
    query: "",
  });
  const { data, isLoading, isError, error, refetch } = useBoard(
    boardId,
    startDate,
    endDate,
  );
  const { create, update, remove, uploadAttachment, deleteAttachment } =
    useTaskMutations(boardId, startDate, endDate);

  const [createColumnId, setCreateColumnId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<TaskSummary | null>(null);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);

  const detailQuery = useTaskDetail(editingId);
  const editingDetail: TaskDetail | null = detailQuery.data ?? null;

  const tasksByColumn = useMemo(() => {
    if (!data) return {};
    return filterTasksByColumn(tasksByColumnFromView(data), filters);
  }, [data, filters]);

  async function uploadPending(taskId: string, files: File[]) {
    const failures: string[] = [];
    for (const file of files) {
      try {
        await uploadAttachment.mutateAsync({ taskId, file });
      } catch (err) {
        failures.push(
          `${file.name}: ${err instanceof Error ? err.message : "upload failed"}`,
        );
      }
    }
    setUploadErrors(failures);
  }

  async function handleCreate(payload: TaskCreate, pendingFiles: File[]) {
    const created = await create.mutateAsync(payload);
    setCreateColumnId(null);
    if (pendingFiles.length) {
      await uploadPending(created.id, pendingFiles);
    }
  }

  async function handleUpdate(payload: TaskCreate, pendingFiles: File[]) {
    if (!editingId) return;
    await update.mutateAsync({
      taskId: editingId,
      payload: {
        title: payload.title,
        description: payload.description,
        content: payload.content,
        due_date: payload.due_date,
        priority: payload.priority,
        links: payload.links,
      },
    });
    if (pendingFiles.length) {
      await uploadPending(editingId, pendingFiles);
    }
    setEditingId(null);
  }

  async function handleDelete() {
    if (!deleting) return;
    await remove.mutateAsync(deleting.id);
    setDeleting(null);
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6">
      <BoardToolbar
        range={range}
        onRangeChange={(next) => {
          if (next[0] && next[1]) setRange(next);
          else if (next[0]) setRange([next[0], next[0]]);
        }}
        boardName={data?.name ?? "Daily Board"}
        filters={filters}
        onFiltersChange={setFilters}
      />

      {data ? (
        <BoardSummaryCard
          summary={data.summary}
          dateLabel={dateLabel}
          loading={isLoading}
        />
      ) : (
        <BoardSummaryCard
          summary={{ total: 0, completed: 0, remaining: 0 }}
          dateLabel={dateLabel}
          loading
        />
      )}

      {uploadErrors.length ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Some attachments failed to upload:
          <ul className="mt-1 list-disc pl-5">
            {uploadErrors.map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {isError ? (
        <div
          className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          role="alert"
        >
          {error instanceof Error ? error.message : "Failed to load board"}
          <button
            type="button"
            className="ml-2 font-medium underline"
            onClick={() => void refetch()}
          >
            Retry
          </button>
        </div>
      ) : null}

      {isLoading && !data ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/50 px-4 py-16 text-center text-slate-500">
          Loading board…
        </div>
      ) : null}

      {data ? (
        <KanbanBoard
          boardId={boardId}
          startDate={startDate}
          endDate={endDate}
          columns={data.columns}
          tasksByColumn={tasksByColumn}
          onAdd={setCreateColumnId}
          onEdit={(task) => setEditingId(task.id)}
          onDelete={setDeleting}
        />
      ) : null}

      <TaskDialog
        open={createColumnId !== null}
        title="Add a task"
        columnId={createColumnId ?? data?.columns[0]?.id ?? ""}
        dueDate={startDate}
        submitting={create.isPending || uploadAttachment.isPending}
        onClose={() => setCreateColumnId(null)}
        onSubmit={handleCreate}
      />

      <TaskDialog
        open={editingId !== null}
        title="Edit task"
        initial={editingDetail}
        columnId={editingDetail?.column_id ?? ""}
        dueDate={startDate}
        submitting={update.isPending || uploadAttachment.isPending}
        loadingDetail={detailQuery.isLoading}
        detailError={
          detailQuery.isError
            ? detailQuery.error instanceof Error
              ? detailQuery.error.message
              : "Failed to load task"
            : null
        }
        onClose={() => setEditingId(null)}
        onSubmit={handleUpdate}
        uploading={uploadAttachment.isPending}
        onUploadExisting={async (file) => {
          if (!editingId) return { download_url: null };
          return uploadAttachment.mutateAsync({ taskId: editingId, file });
        }}
        onDeleteAttachment={async (attachmentId) => {
          if (!editingId) return;
          await deleteAttachment.mutateAsync({ taskId: editingId, attachmentId });
        }}
      />

      <DeleteTaskDialog
        open={deleting !== null}
        taskTitle={deleting?.title ?? ""}
        submitting={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => void handleDelete()}
      />
    </main>
  );
}
