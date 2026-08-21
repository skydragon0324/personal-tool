"use client";

import { useEffect, useMemo, useState } from "react";

import { DeleteTaskDialog } from "@/features/tasks/components/delete-task-dialog";
import { RecurrenceScopeDialog } from "@/features/tasks/components/recurrence-scope-dialog";
import { TaskDetailDrawer } from "@/features/tasks/components/task-detail-drawer";
import { TaskDialog } from "@/features/tasks/components/task-dialog";
import { ApiError } from "@/lib/api-client";
import { formatRangeLabel, todayISO } from "@/lib/dates";
import { notifyApiError, notifyConflict } from "@/lib/notify";
import { tasksByColumnFromView } from "../api/board-queries";
import { useBoard } from "../hooks/use-board";
import { useCategories } from "../hooks/use-categories";
import { useMoveTask } from "../hooks/use-move-task";
import { useTaskMutations } from "../hooks/use-task-mutations";
import { useBoardPreferences } from "../hooks/use-board-preferences";
import type {
  BoardFilters,
  BoardQueryParams,
  TaskCreate,
  TaskDetail,
  TaskSummary,
  TaskUpdate,
} from "../types";
import { applyRangeChange } from "../utils/board-range";
import {
  DEFAULT_FILTERS,
  expandRangeToInclude,
  formatMonthLabel,
  formatWeekRangeLabel,
  formatYearLabel,
  rangeForMode,
  type DateField,
  type DateRangeMode,
  type DateRangeValue,
} from "../utils/date-presets";
import { filterTasksByColumn } from "../utils/filter-tasks";
import { rangesFromPreferences, readBoardPreferences } from "../utils/board-preferences";
import { writeLastBoardId } from "../utils/last-board";
import { createSaveNotice, isTaskInDateView } from "../utils/task-visibility";
import { BoardHeader } from "./board-header";
import { BoardSummaryCard } from "./board-summary";
import { BoardToolbar } from "./board-toolbar";
import { KanbanBoard } from "./kanban-board";
import { NoStatusesState } from "./no-statuses-state";
import { ProgressView } from "./progress-view";
import { SaveNotice } from "./save-notice";
import { StatusManagerModal } from "./status-manager-modal";
import { TaskTable } from "./task-table";

interface BoardPageProps {
  boardId: string;
  initialDate: string;
}

export function BoardPage({ boardId, initialDate }: BoardPageProps) {
  const { prefs, updatePrefs } = useBoardPreferences(boardId);
  const defaultRange = rangeForMode(prefs.rangeMode, initialDate, prefs.anchorDate);
  const [pickerRange, setPickerRange] = useState<DateRangeValue>(defaultRange);
  const [appliedRange, setAppliedRange] = useState<DateRangeValue>(defaultRange);
  const [rangeMode, setRangeMode] = useState<DateRangeMode>(prefs.rangeMode);
  const [dateField, setDateField] = useState<DateField>(prefs.dateField);
  const [customError, setCustomError] = useState<string | null>(null);
  const [filters, setFilters] = useState<BoardFilters>({
    priority: prefs.priority,
    query: DEFAULT_FILTERS.query,
    categoryId: prefs.categoryId,
  });

  useEffect(() => {
    const loaded = readBoardPreferences(boardId, window.localStorage, todayISO());
    const ranges = rangesFromPreferences(loaded, todayISO());
    setPickerRange(ranges.pickerRange);
    setAppliedRange(ranges.appliedRange);
    setRangeMode(loaded.rangeMode);
    setDateField(loaded.dateField);
    setCustomError(null);
    setFilters({
      priority: loaded.priority,
      query: "",
      categoryId: loaded.categoryId,
    });
    writeLastBoardId(boardId, window.localStorage);
  }, [boardId]);

  const unbounded = rangeMode === "all";
  const startDate = appliedRange[0] || todayISO();
  const endDate = appliedRange[1] || appliedRange[0] || todayISO();
  const query: BoardQueryParams = {
    boardId,
    startDate,
    endDate,
    dateField,
    unbounded,
  };
  const dateLabel = unbounded
    ? "All"
    : rangeMode === "year" && appliedRange[0]
      ? formatYearLabel(appliedRange[0])
      : rangeMode === "month" && appliedRange[0]
        ? formatMonthLabel(appliedRange[0])
        : rangeMode === "week" && appliedRange[0] && appliedRange[1]
          ? formatWeekRangeLabel(appliedRange[0], appliedRange[1])
          : formatRangeLabel(startDate, endDate);

  const viewMode = prefs.viewMode;
  const { data, isLoading, isError, error, refetch } = useBoard(query);
  const categoriesQuery = useCategories(boardId);
  const moveTask = useMoveTask(query);
  const { create, update, remove, stopRecurrence, uploadAttachment, deleteAttachment } = useTaskMutations(
    query,
    {
      shouldApplyToView: (task) =>
        isTaskInDateView(task, {
          startDate: unbounded ? null : startDate,
          endDate: unbounded ? null : endDate,
          unbounded,
          dateField,
        }),
    },
  );

  const [createColumnId, setCreateColumnId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [detailMode, setDetailMode] = useState<"view" | "edit">("view");
  const [deleting, setDeleting] = useState<{
    id: string;
    title: string;
    repeating?: boolean;
    completed?: boolean;
  } | null>(null);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusTab, setStatusTab] = useState<"active" | "archived">("active");
  const [saveNotice, setSaveNotice] = useState<ReturnType<typeof createSaveNotice> | null>(
    null,
  );

  useEffect(() => {
    const task = new URLSearchParams(window.location.search).get("task");
    if (task) {
      setViewingId(task);
      setDetailMode("view");
    }
  }, [boardId]);

  const tasksByColumn = useMemo(() => {
    if (!data) return {};
    return filterTasksByColumn(tasksByColumnFromView(data), filters);
  }, [data, filters]);

  function applyMode(next: DateRangeMode) {
    setRangeMode(next);
    setCustomError(null);
    if (next === "custom") {
      const draft = appliedRange[0] && appliedRange[1] ? appliedRange : ([null, null] as DateRangeValue);
      setPickerRange(draft);
      updatePrefs({
        rangeMode: "custom",
        customRange: draft[0] && draft[1] ? draft : null,
      });
      return;
    }
    const range = rangeForMode(next, todayISO(), todayISO());
    setPickerRange(range);
    setAppliedRange(range);
    updatePrefs({ rangeMode: next, customRange: null, anchorDate: range[0] });
  }

  function resetFilters() {
    const range = rangeForMode("month", todayISO());
    setRangeMode("month");
    setDateField("due_date");
    setPickerRange(range);
    setAppliedRange(range);
    setCustomError(null);
    setFilters({
      priority: "",
      query: "",
      categoryId: "",
    });
    updatePrefs({
      rangeMode: "month",
      dateField: "due_date",
      priority: "",
      categoryId: "",
      customRange: null,
      anchorDate: range[0],
    });
  }

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

  function showSaveNotice(task: TaskDetail) {
    setSaveNotice(
      createSaveNotice(
        task,
        {
          startDate: unbounded ? null : startDate,
          endDate: unbounded ? null : endDate,
          unbounded,
          dateField,
        },
        filters,
      ),
    );
  }

  async function handleCreate(
    payload: TaskCreate,
    pendingFiles: File[],
    existingId?: string,
  ) {
    if (existingId) {
      const updated = await update.mutateAsync({
        taskId: existingId,
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
      if (pendingFiles.length) {
        await uploadPending(existingId, pendingFiles);
      }
      showSaveNotice(updated);
      return updated;
    }
    const created = await create.mutateAsync(payload);
    if (pendingFiles.length) {
      await uploadPending(created.id, pendingFiles);
    }
    showSaveNotice(created);
    return created;
  }

  async function handleUpdate(payload: TaskCreate, pendingFiles: File[]) {
    if (!viewingId) {
      throw new Error("Task is not loaded");
    }
    const updated = await update.mutateAsync({
      taskId: viewingId,
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
      } satisfies TaskUpdate,
    });
    if (pendingFiles.length) {
      await uploadPending(viewingId, pendingFiles);
    }
    showSaveNotice(updated);
    return updated;
  }

  async function handleDelete(
    scope: "this" | "this_and_future" | "series" = "this",
    confirmCompleted = false,
  ) {
    if (!deleting) return;
    await remove.mutateAsync({
      taskId: deleting.id,
      deleteScope: deleting.repeating ? scope : "this",
      confirmCompleted,
    });
    if (viewingId === deleting.id) setViewingId(null);
    setDeleting(null);
  }

  async function handleMoveStatus(task: TaskSummary, columnId: string) {
    if (columnId === task.column_id) return;
    try {
      await moveTask.mutateAsync({
        taskId: task.id,
        payload: {
          target_column_id: columnId,
          expected_version: task.version,
        },
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        notifyConflict();
        return;
      }
      notifyApiError(err, "Could not change status");
    }
  }

  function viewSavedTask() {
    if (!saveNotice) return;
    const next = expandRangeToInclude(
      unbounded ? [null, null] : appliedRange,
      saveNotice.jumpDate,
    );
    setRangeMode("custom");
    setPickerRange(next);
    setAppliedRange(next);
    updatePrefs({ rangeMode: "custom", customRange: next, anchorDate: next[0] });
  }

  const hasStatuses = (data?.columns.length ?? 0) > 0;
  const showEmptyStatuses = Boolean(data && !hasStatuses);

  useEffect(() => {
    const name = data?.name;
    document.title = name ? `${name} · Life Management` : "Life Management";
    return () => {
      document.title = "Life Management";
    };
  }, [data?.name]);

  return (
    <div className="min-h-full bg-[var(--app-bg)] text-[var(--app-text)]">
      <BoardHeader
        boardName={data?.name ?? "Board"}
        boardColor={data?.color}
        boardIcon={data?.icon_name}
        timezone={data?.timezone}
        viewMode={viewMode}
        onViewModeChange={(mode) => updatePrefs({ viewMode: mode })}
        onQuickAdd={() => setCreateColumnId(data?.columns[0]?.id ?? null)}
        onManageStatuses={() => {
          setStatusTab("active");
          setStatusOpen(true);
        }}
        quickAddDisabled={!hasStatuses}
      />
      <BoardToolbar
        range={pickerRange}
        onRangeChange={(next) => {
          if (rangeMode === "custom") {
            const result = applyRangeChange(next, appliedRange);
            setPickerRange(result.pickerRange);
            return;
          }
          setPickerRange(next);
          setAppliedRange(next);
          updatePrefs({ rangeMode, customRange: null, anchorDate: next[0] });
        }}
        rangeMode={rangeMode}
        onRangeModeChange={applyMode}
        dateField={dateField}
        onDateFieldChange={(next) => {
          setDateField(next);
          updatePrefs({ dateField: next });
        }}
        filters={filters}
        onFiltersChange={(next) => {
          setFilters(next);
          updatePrefs({ priority: next.priority, categoryId: next.categoryId });
        }}
        categories={categoriesQuery.data ?? []}
        onReset={resetFilters}
        customError={customError}
        onCustomError={setCustomError}
        onApplyCustom={(range) => {
          setPickerRange(range);
          setAppliedRange(range);
          updatePrefs({ rangeMode: "custom", customRange: range, anchorDate: range[0] });
        }}
      />

      {saveNotice ? (
        <SaveNotice
          message={saveNotice.message}
          outOfRange={saveNotice.outOfRange}
          hiddenByFilters={saveNotice.hiddenByFilters}
          onViewTask={saveNotice.outOfRange ? viewSavedTask : undefined}
          onDismiss={() => setSaveNotice(null)}
        />
      ) : null}

      {data ? (
        <BoardSummaryCard
          summary={data.summary}
          dateLabel={dateLabel}
          loading={isLoading}
          truncated={data.truncated}
          taskLimit={data.task_limit}
        />
      ) : (
        <BoardSummaryCard
          summary={{ total: 0, completed: 0, remaining: 0 }}
          dateLabel={dateLabel}
          loading
        />
      )}

      {uploadErrors.length ? (
        <div className="mx-auto mb-4 max-w-[1400px] px-4 text-sm sm:px-6">
          <div className="rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
            Some attachments failed to upload:
            <ul className="mt-1 list-disc pl-5">
              {uploadErrors.map((msg) => (
                <li key={msg}>{msg}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {isError ? (
        <div
          className="mx-auto mb-4 max-w-[1400px] px-4 sm:px-6"
          role="alert"
        >
          <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-100">
            {error instanceof Error ? error.message : "Failed to load board"}
            <button
              type="button"
              className="ml-2 font-medium underline"
              onClick={() => void refetch()}
            >
              Retry
            </button>
          </div>
        </div>
      ) : null}

      {isLoading && !data ? (
        <div className="mx-auto max-w-[1400px] px-4 py-16 text-center text-[var(--app-text-muted)] sm:px-6">
          Loading board…
        </div>
      ) : null}

      {showEmptyStatuses ? (
        <NoStatusesState
          onCreate={() => {
            setStatusTab("active");
            setStatusOpen(true);
          }}
        />
      ) : null}

      {data && hasStatuses && viewMode === "board" ? (
        <KanbanBoard
          query={query}
          columns={data.columns}
          tasksByColumn={tasksByColumn}
          onAdd={setCreateColumnId}
          onOpenDetail={(task, mode = "view") => {
            setViewingId(task.id);
            setDetailMode(mode);
          }}
          onDelete={(task) =>
            setDeleting({
              id: task.id,
              title: task.title,
              repeating: Boolean(task.recurrence?.series_id),
              completed: Boolean(task.completed_at),
            })
          }
        />
      ) : null}

      {data && hasStatuses && viewMode === "table" ? (
        <TaskTable
          columns={data.columns}
          tasksByColumn={tasksByColumn}
          onOpenDetail={(task, mode = "view") => {
            setViewingId(task.id);
            setDetailMode(mode);
          }}
          onMoveStatus={(task, columnId) => void handleMoveStatus(task, columnId)}
        />
      ) : null}

      {data && hasStatuses && viewMode === "progress" ? (
        <ProgressView columns={data.columns} tasksByColumn={tasksByColumn} />
      ) : null}

      <TaskDialog
        open={createColumnId !== null}
        title="Add task"
        boardId={boardId}
        columnId={createColumnId ?? data?.columns[0]?.id ?? ""}
        dueDate={todayISO()}
        submitting={create.isPending || uploadAttachment.isPending || update.isPending}
        onClose={() => setCreateColumnId(null)}
        onSubmit={handleCreate}
        onUploadFile={async (taskId, file) =>
          uploadAttachment.mutateAsync({ taskId, file })
        }
        onPatchContent={async (taskId, content) => {
          await update.mutateAsync({ taskId, payload: { content } });
        }}
      />

      <TaskDetailDrawer
        taskId={viewingId}
        mode={detailMode}
        boardId={boardId}
        query={query}
        columns={data?.columns ?? []}
        submitting={update.isPending || uploadAttachment.isPending}
        onModeChange={setDetailMode}
        onClose={() => setViewingId(null)}
        onSubmit={handleUpdate}
        onUploadFile={async (taskId, file) =>
          uploadAttachment.mutateAsync({ taskId, file })
        }
        onPatchContent={async (taskId, content) => {
          await update.mutateAsync({ taskId, payload: { content } });
        }}
        onDeleteAttachment={async (attachmentId) => {
          if (!viewingId) return;
          await deleteAttachment.mutateAsync({ taskId: viewingId, attachmentId });
        }}
        onDelete={(taskId, title, meta) => {
          setDeleting({
            id: taskId,
            title,
            repeating: Boolean(meta?.repeating),
            completed: Boolean(meta?.completed),
          });
        }}
        onStopRepeat={
          viewingId
            ? async (seriesId) => {
                await stopRecurrence.mutateAsync(seriesId);
              }
            : undefined
        }
      />

      {deleting?.repeating ? (
        <RecurrenceScopeDialog
          open
          mode="delete"
          taskTitle={deleting.title}
          completed={Boolean(deleting.completed)}
          submitting={remove.isPending}
          onClose={() => setDeleting(null)}
          onConfirm={(scope, confirmCompleted) =>
            void handleDelete(scope, Boolean(confirmCompleted || deleting.completed))
          }
        />
      ) : (
        <DeleteTaskDialog
          open={deleting !== null}
          taskTitle={deleting?.title ?? ""}
          submitting={remove.isPending}
          onClose={() => setDeleting(null)}
          onConfirm={() => void handleDelete()}
        />
      )}

      <StatusManagerModal
        opened={statusOpen}
        onClose={() => setStatusOpen(false)}
        boardId={boardId}
        initialTab={statusTab}
      />
    </div>
  );
}
