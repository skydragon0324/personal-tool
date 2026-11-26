import { Alert, Button, Group, Loader, Modal, Select, Text } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";

import { activeBoards, useBoards } from "@/features/board/hooks/use-boards";
import { useColumns } from "@/features/board/hooks/use-columns";
import { useTaskMutations } from "@/features/board/hooks/use-task-mutations";
import type { BoardQueryParams, ColumnDetail, TaskCreate, TaskDetail } from "@/features/board/types";
import { readLastBoardId, resolveLastBoardId } from "@/features/board/utils/last-board";
import { formatLongDate } from "@/lib/dates";
import { notifyApiError, notifySuccess } from "@/lib/notify";
import { t } from "@/i18n";

import { TaskDialog } from "./task-dialog";

/** The status a new task starts in: the board's first open status, else its first status. */
export function startingColumn(columns: ColumnDetail[]): ColumnDetail | null {
  const active = columns.filter((column) => !column.archived_at).sort((a, b) => a.position - b.position);
  return active.find((column) => !column.is_done) ?? active[0] ?? null;
}

interface QuickCreateTaskProps {
  opened: boolean;
  /** Due (and start) date the new task gets; the form still lets the user change it. */
  dueDate: string;
  /** Board to create the task on. Without one the user picks a board (skipped when there is only one). */
  boardId?: string | null;
  onClose: () => void;
  onCreated?: (task: TaskDetail) => void;
}

/**
 * Create a task from outside a board (the Calendar): choose the board when needed,
 * then the regular task dialog with the date filled in. Saving goes through the same task
 * mutations as the board page.
 */
export function QuickCreateTask({ opened, dueDate, boardId: fixedBoardId, onClose, onCreated }: QuickCreateTaskProps) {
  const boardsQuery = useBoards(false);
  const boards = useMemo(() => activeBoards(boardsQuery.data), [boardsQuery.data]);
  const [boardId, setBoardId] = useState<string | null>(null);
  const [step, setStep] = useState<"board" | "form">("board");
  // Set up once per opening: a later refetch of the board list must not send the user back to the
  // board step (and throw away what they typed).
  const [ready, setReady] = useState(false);
  const boardsLoaded = Boolean(boardsQuery.data);

  useEffect(() => {
    if (!opened) {
      setReady(false);
      setStep("board");
      return;
    }
    if (ready) return;
    if (fixedBoardId) {
      setBoardId(fixedBoardId);
      setStep("form");
      setReady(true);
      return;
    }
    if (!boardsLoaded) return;
    const stored = typeof window === "undefined" ? null : readLastBoardId(window.localStorage);
    setBoardId(resolveLastBoardId(boards, stored));
    setStep(boards.length === 1 ? "form" : "board");
    setReady(true);
  }, [opened, ready, fixedBoardId, boardsLoaded, boards]);

  const board = boards.find((item) => item.id === boardId) ?? null;

  return (
    <>
      <Modal
        opened={opened && step === "board" && !fixedBoardId}
        onClose={onClose}
        title={t("calendar.newTaskOn", { date: formatLongDate(dueDate) })}
        radius="lg"
        centered
      >
        {boardsQuery.isLoading ? (
          <Group justify="center" py="md">
            <Loader size="sm" />
          </Group>
        ) : boards.length === 0 ? (
          <Text size="sm">{t("calendar.noBoardsForTask")}</Text>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (boardId) setStep("form");
            }}
          >
            <Select
              data-autofocus
              label={t("calendar.chooseBoard")}
              data={boards.map((item) => ({ value: item.id, label: item.name }))}
              value={boardId}
              onChange={setBoardId}
              allowDeselect={false}
              searchable
              comboboxProps={{ withinPortal: true }}
            />
            <Group justify="flex-end" mt="lg">
              <Button variant="default" onClick={onClose}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={!boardId}>
                {t("calendar.continue")}
              </Button>
            </Group>
          </form>
        )}
      </Modal>
      {opened && step === "form" && boardId ? (
        <QuickCreateTaskForm
          boardId={boardId}
          boardName={board?.name ?? ""}
          dueDate={dueDate}
          onClose={onClose}
          onCreated={onCreated}
        />
      ) : null}
    </>
  );
}

function QuickCreateTaskForm({
  boardId,
  boardName,
  dueDate,
  onClose,
  onCreated,
}: {
  boardId: string;
  boardName: string;
  dueDate: string;
  onClose: () => void;
  onCreated?: (task: TaskDetail) => void;
}) {
  const columnsQuery = useColumns(boardId, false);
  const column = startingColumn(columnsQuery.data ?? []);
  const query: BoardQueryParams = { boardId, startDate: dueDate, endDate: dueDate, dateField: "due_date", unbounded: false };
  const { create, update, uploadAttachment } = useTaskMutations(query);

  async function uploadPending(taskId: string, files: File[]) {
    for (const file of files) {
      try {
        await uploadAttachment.mutateAsync({ taskId, file });
      } catch (error) {
        notifyApiError(error, t("boardPage.uploadFailed"));
      }
    }
  }

  // Same flow as the board's "Add task": the form may save once to get an id (for pasted images)
  // and then save again with that id.
  async function handleSubmit(payload: TaskCreate, pendingFiles: File[], existingId?: string): Promise<TaskDetail> {
    const saved = existingId
      ? await update.mutateAsync({
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
            remind_at: payload.remind_at,
            assignee_ids: payload.assignee_ids,
          },
        })
      : await create.mutateAsync(payload);
    if (pendingFiles.length) await uploadPending(saved.id, pendingFiles);
    if (!existingId) {
      notifySuccess(t("boardPage.created", { title: saved.title }));
      onCreated?.(saved);
    }
    return saved;
  }

  if (columnsQuery.isLoading || columnsQuery.isError || !column) {
    return (
      <Modal opened onClose={onClose} title={t("calendar.newTaskIn", { board: boardName })} radius="lg" centered>
        {columnsQuery.isLoading ? (
          <Group justify="center" py="md">
            <Loader size="sm" />
          </Group>
        ) : (
          <Alert color="red">{columnsQuery.isError ? t("workspace.couldNotLoad") : t("calendar.boardHasNoStatuses")}</Alert>
        )}
      </Modal>
    );
  }

  return (
    <TaskDialog
      open
      title={t("calendar.newTaskIn", { board: boardName })}
      boardId={boardId}
      columnId={column.id}
      dueDate={dueDate}
      submitting={create.isPending || update.isPending || uploadAttachment.isPending}
      onClose={onClose}
      onSubmit={handleSubmit}
      onUploadFile={(taskId, file) => uploadAttachment.mutateAsync({ taskId, file })}
      onPatchContent={async (taskId, content) => {
        await update.mutateAsync({ taskId, payload: { content } });
      }}
      uploading={uploadAttachment.isPending}
    />
  );
}
