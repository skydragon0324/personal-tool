import { Alert, Anchor, Badge, Button, Group, Loader, Menu, Modal, Stack, Text } from "@mantine/core";
import { useEffect, useState } from "react";

import { DiscardChangesModal } from "@/components/discard-changes-modal";
import type {
  BoardColumn,
  BoardQueryParams,
  TaskCreate,
  TaskDetail,
  TiptapJSON,
} from "@/features/board/types";
import { AssigneeAvatars } from "@/features/board/components/assignee-avatars";
import { useTaskDetail } from "@/features/board/hooks/use-task-detail";
import { CategoryBadge } from "./category-badge";
import { PriorityBadge } from "./priority-badge";
import { SubtaskList } from "./subtask-list";
import { TaskContentViewer } from "./task-content-viewer";
import { TaskForm } from "./task-form";
import { recurrenceLabel } from "./recurrence-fields";
import { formatDateTime, formatTaskPeriod } from "@/lib/dates";
import { t } from "@/i18n";

interface TaskDetailModalProps {
  taskId: string | null;
  mode: "view" | "edit";
  boardId: string;
  query: BoardQueryParams;
  columns: BoardColumn[];
  submitting?: boolean;
  onModeChange: (mode: "view" | "edit") => void;
  onClose: () => void;
  /** Show another task in this modal (a sub-task, or a sub-task's parent). */
  onOpenTask: (taskId: string) => void;
  onSubmit: (payload: TaskCreate, pendingFiles: File[], existingId?: string) => Promise<TaskDetail>;
  onUploadFile?: (taskId: string, file: File) => Promise<{ download_url: string | null }>;
  onPatchContent?: (taskId: string, content: TiptapJSON) => Promise<void>;
  onDeleteAttachment?: (attachmentId: string) => Promise<void>;
  onDelete: (
    taskId: string,
    title: string,
    meta?: { repeating?: boolean; completed?: boolean; parentId?: string | null },
  ) => void;
  onStopRepeat?: (seriesId: string) => Promise<void> | void;
  onDuplicate?: (task: TaskDetail) => void;
  onMoveToBoard?: (task: TaskDetail) => void;
}

export function TaskDetailModal({
  taskId,
  mode,
  boardId,
  query,
  columns,
  submitting,
  onModeChange,
  onClose,
  onOpenTask,
  onSubmit,
  onUploadFile,
  onPatchContent,
  onDeleteAttachment,
  onDelete,
  onStopRepeat,
  onDuplicate,
  onMoveToBoard,
}: TaskDetailModalProps) {
  const detailQuery = useTaskDetail(taskId);
  const task = detailQuery.data ?? null;
  const [localMode, setLocalMode] = useState(mode);
  const [editDirty, setEditDirty] = useState(false);
  // Where to go once the user confirms throwing away unsaved edits.
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null);

  useEffect(() => {
    setLocalMode(mode);
  }, [mode, taskId]);

  useEffect(() => {
    if (localMode !== "edit") setEditDirty(false);
  }, [localMode]);

  // Leaving the edit form (close, cancel, or opening another task) asks first when there are
  // unsaved edits.
  function guard(action: () => void) {
    if (localMode === "edit" && editDirty) setPendingLeave(() => action);
    else action();
  }

  const statusName = columns.find((column) => column.id === task?.column_id)?.name ?? t("tasks.unknownStatus");
  const isSubtask = Boolean(task?.parent);
  const noun = isSubtask ? t("tasks.nounSubtask") : t("tasks.nounTask");

  function openTask(id: string) {
    guard(() => {
      setLocalMode("view");
      onModeChange("view");
      onOpenTask(id);
    });
  }

  function leaveEdit() {
    setLocalMode("view");
    onModeChange("view");
  }

  return (
    <>
      <Modal
        opened={taskId !== null}
        onClose={() => guard(onClose)}
        title={
          localMode === "edit"
            ? t("tasks.editTitle", { noun })
            : isSubtask
              ? t("tasks.subtaskDetails")
              : t("tasks.taskDetails")
        }
        size="xl"
        radius="lg"
        padding="lg"
        returnFocus={false}
        trapFocus={false}
        transitionProps={{ duration: 120 }}
        classNames={{
          // One scroll area: the modal is a fixed-height column; the form or the details scroll inside.
          content: "max-w-4xl w-[min(96vw,56rem)] !flex flex-col !overflow-hidden",
          body: "flex min-h-0 flex-1 flex-col",
        }}
      >
        {task?.parent ? (
          <Anchor
            component="button"
            type="button"
            size="sm"
            mb="sm"
            className="block max-w-full truncate text-left"
            onClick={() => openTask(task.parent!.id)}
          >
            {t("tasks.subtaskOf", { title: task.parent.title })}
          </Anchor>
        ) : null}
        {detailQuery.isLoading ? (
          <Group justify="center" py="xl">
            <Loader />
          </Group>
        ) : null}
        {detailQuery.isError ? (
          <Alert color="red">
            {detailQuery.error instanceof Error ? detailQuery.error.message : t("tasks.failedToLoad")}
          </Alert>
        ) : null}
        {task && localMode === "edit" ? (
          <TaskForm
            key={`${task.id}-edit`}
            initial={task}
            boardId={boardId}
            columnId={task.column_id}
            dueDate={task.due_date}
            submitting={submitting}
            onSubmit={async (payload, files, existingId) => {
              const saved = await onSubmit(payload, files, existingId);
              await detailQuery.refetch();
              setLocalMode("view");
              onModeChange("view");
              return saved;
            }}
            onCancel={() => guard(leaveEdit)}
            onDirtyChange={setEditDirty}
            onUploadFile={onUploadFile}
            onPatchContent={onPatchContent}
            onDeleteAttachment={onDeleteAttachment}
          />
        ) : null}
        {task && localMode === "view" ? (
          <Stack gap="md" className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div>
              <h2 className="font-display text-2xl text-[var(--app-text)]">{task.title}</h2>
              <Text size="sm" c="dimmed" mt={4}>
                {t("tasks.statusLine", { name: statusName })}
              </Text>
            </div>
            <Group>
              <CategoryBadge category={task.category} />
              <PriorityBadge priority={task.priority} />
              {task.recurrence ? <Badge variant="light">{recurrenceLabel(task.recurrence)}</Badge> : null}
            </Group>
            <Text size="sm">{formatTaskPeriod(task.start_date, task.due_date)}</Text>
            {task.assignees?.length ? <AssigneeAvatars people={task.assignees} size={28} max={6} /> : null}
            {task.remind_at ? <Text size="sm">{t("tasks.reminder", { date: formatDateTime(task.remind_at) })}</Text> : null}
            <Text size="xs" c="dimmed">
              {t("tasks.createdUpdated", {
                created: formatDateTime(task.created_at),
                updated: formatDateTime(task.updated_at),
              })}
            </Text>
            <TaskContentViewer value={task.content} />
            {isSubtask ? null : (
              <SubtaskList
                taskId={task.id}
                query={query}
                subtasks={task.subtasks ?? []}
                onOpen={openTask}
                onDelete={(subtask) =>
                  onDelete(subtask.id, subtask.title, {
                    completed: subtask.is_completed,
                    parentId: task.id,
                  })
                }
              />
            )}
            <section>
              <h3 className="mb-2 font-medium">{t("taskForm.referenceLinks")}</h3>
              {task.links.length ? (
                <ul className="space-y-1 text-sm">
                  {task.links.map((link) => (
                    <li key={link.id}>
                      <a href={link.url} target="_blank" rel="noreferrer" className="text-[var(--app-primary)]">
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <Text size="sm" c="dimmed">
                  {t("taskForm.noReferenceLinks")}
                </Text>
              )}
            </section>
            <section>
              <h3 className="mb-2 font-medium">{t("taskForm.attachments")}</h3>
              {task.attachments.length ? (
                <ul className="space-y-1 text-sm">
                  {task.attachments.map((attachment) => (
                    <li key={attachment.id}>
                      {attachment.download_url ? (
                        <a href={attachment.download_url} target="_blank" rel="noreferrer">
                          {attachment.original_name}
                        </a>
                      ) : (
                        attachment.original_name
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <Text size="sm" c="dimmed">
                  {t("tasks.noFiles")}
                </Text>
              )}
            </section>
            <Group>
              <Button onClick={() => setLocalMode("edit")}>{t("common.edit")}</Button>
              <Menu>
                <Menu.Target>
                  <Button variant="default">{t("common.more")}</Button>
                </Menu.Target>
                <Menu.Dropdown>
                  {task.recurrence?.status === "active" && onStopRepeat ? (
                    <Menu.Item
                      onClick={() => {
                        void onStopRepeat(task.recurrence!.series_id);
                      }}
                    >
                      {t("taskForm.stopRepeating")}
                    </Menu.Item>
                  ) : null}
                  {onDuplicate ? (
                    <Menu.Item onClick={() => onDuplicate(task)}>{t("task.duplicate")}</Menu.Item>
                  ) : null}
                  {onMoveToBoard && !isSubtask ? (
                    <Menu.Item onClick={() => onMoveToBoard(task)}>{t("task.moveToBoard")}</Menu.Item>
                  ) : null}
                  <Menu.Item
                    color="red"
                    onClick={() =>
                      onDelete(task.id, task.title, {
                        repeating: Boolean(task.recurrence?.series_id),
                        completed: Boolean(task.completed_at),
                        parentId: task.parent?.id ?? null,
                      })
                    }
                  >
                    {t("common.delete")}
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          </Stack>
        ) : null}
      </Modal>
      <DiscardChangesModal
        opened={pendingLeave !== null}
        onKeepEditing={() => setPendingLeave(null)}
        onDiscard={() => {
          const leave = pendingLeave;
          setPendingLeave(null);
          setEditDirty(false);
          leave?.();
        }}
      />
    </>
  );
}
