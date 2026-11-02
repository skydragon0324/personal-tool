import { Alert, Button, Group, Loader, Menu, Modal, Text } from "@mantine/core";
import { useEffect, useState, type ReactNode } from "react";

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
import { statusHeaderClass } from "@/features/board/utils/status-colors";
import { t } from "@/i18n";
import { formatDateTime, formatTaskPeriod } from "@/lib/dates";
import { subtaskProgressLabel } from "../hooks/use-subtasks";
import { CategoryBadge } from "./category-badge";
import { PriorityBadge } from "./priority-badge";
import { SubtaskList } from "./subtask-list";
import { TaskContentViewer } from "./task-content-viewer";
import { TaskForm } from "./task-form";
import { recurrenceLabel } from "./recurrence-fields";

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

  const column = columns.find((item) => item.id === task?.column_id);
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
        size="auto"
        radius="lg"
        padding="lg"
        returnFocus={false}
        trapFocus={false}
        transitionProps={{ duration: 120 }}
        classNames={{
          // A large, fixed-size frame: the header and action bar stay put and only the middle scrolls.
          content: "w-[min(96vw,72rem)] h-[min(90dvh,60rem)] !max-h-[90dvh] !flex flex-col !overflow-hidden",
          body: "flex min-h-0 flex-1 flex-col gap-3",
        }}
      >
        {task?.parent ? (
          // shrink-0: inside the flex column this must never be squeezed by the content below.
          <div className="shrink-0">
            <Button
              variant="light"
              size="xs"
              leftSection={<BackIcon />}
              onClick={() => openTask(task.parent!.id)}
              className="max-w-full"
              classNames={{ label: "truncate" }}
            >
              {t("tasks.backToParent", { title: task.parent.title })}
            </Button>
          </div>
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
              return saved;
            }}
            onCancel={() => guard(leaveEdit)}
            onSaved={() => {
              // Saved: back to the details without asking about "unsaved" edits.
              setEditDirty(false);
              leaveEdit();
            }}
            onDirtyChange={setEditDirty}
            onUploadFile={onUploadFile}
            onPatchContent={onPatchContent}
            onDeleteAttachment={onDeleteAttachment}
          />
        ) : null}
        {task && localMode === "view" ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <h2 className="mb-4 break-words font-display text-2xl text-[var(--app-text)] sm:text-3xl">
                {task.title}
              </h2>
              <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="min-w-0 space-y-4">
                  <DetailSection icon={<DetailsIcon />} title={t("taskForm.details")}>
                    {hasContent(task) ? (
                      // Long details scroll inside this box instead of stretching the modal.
                      <div className="h-[22rem] overflow-y-auto rounded-lg">
                        <TaskContentViewer value={task.content} />
                      </div>
                    ) : (
                      <Text size="sm" c="dimmed">
                        {t("tasks.noContent")}
                      </Text>
                    )}
                  </DetailSection>
                  {isSubtask ? null : (
                    <DetailSection
                      icon={<SubtasksIcon />}
                      title={t("tasks.subtasks")}
                      aside={
                        task.subtasks?.length ? (
                          <span className="text-xs text-[var(--app-text-muted)]">
                            {subtaskProgressLabel(task.subtasks)}
                          </span>
                        ) : null
                      }
                    >
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
                    </DetailSection>
                  )}
                </div>

                <div className="min-w-0 space-y-4">
                  <DetailSection icon={<PropertiesIcon />} title={t("tasks.properties")}>
                    <dl className="space-y-3 text-sm">
                      <Property label={t("task.status")}>
                        <span className="inline-flex items-center gap-2">
                          <span
                            className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusHeaderClass(column?.color ?? "slate")}`}
                            aria-hidden
                          />
                          {column?.name ?? t("tasks.unknownStatus")}
                        </span>
                      </Property>
                      <Property label={t("task.category")}>
                        <CategoryBadge category={task.category} />
                      </Property>
                      <Property label={t("task.priority")}>
                        <PriorityBadge priority={task.priority} />
                      </Property>
                      <Property label={t("task.dates")}>
                        {formatTaskPeriod(task.start_date, task.due_date)}
                      </Property>
                      {isSubtask ? null : (
                        <Property label={t("tasks.repeat")}>
                          {task.recurrence ? recurrenceLabel(task.recurrence) : t("tasks.doesNotRepeat")}
                        </Property>
                      )}
                      <Property label={t("tasks.assignees")}>
                        {task.assignees?.length ? (
                          <AssigneeAvatars people={task.assignees} size={26} max={6} />
                        ) : (
                          <span className="text-[var(--app-text-muted)]">{t("filters.unassigned")}</span>
                        )}
                      </Property>
                      <Property label={t("tasks.reminderLabel")}>
                        {task.remind_at ? (
                          formatDateTime(task.remind_at)
                        ) : (
                          <span className="text-[var(--app-text-muted)]">{t("tasks.noReminder")}</span>
                        )}
                      </Property>
                      <Property label={t("tasks.created")}>
                        <span className="text-[var(--app-text-muted)]">{formatDateTime(task.created_at)}</span>
                      </Property>
                      <Property label={t("tasks.updated")}>
                        <span className="text-[var(--app-text-muted)]">{formatDateTime(task.updated_at)}</span>
                      </Property>
                    </dl>
                  </DetailSection>

                  <DetailSection
                    icon={<LinkIcon />}
                    title={t("tasks.linksTitle")}
                    aside={<Count value={task.links.length} />}
                  >
                    {task.links.length ? (
                      <ul className="space-y-1.5 text-sm">
                        {task.links.map((link) => (
                          <li key={link.id} className="truncate">
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noreferrer"
                              title={link.url}
                              className="text-[var(--app-primary)] hover:underline"
                            >
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
                  </DetailSection>

                  <DetailSection
                    icon={<FileIcon />}
                    title={t("tasks.filesTitle")}
                    aside={<Count value={task.attachments.length} />}
                  >
                    {task.attachments.length ? (
                      <ul className="space-y-1.5 text-sm">
                        {task.attachments.map((attachment) => (
                          <li key={attachment.id} className="truncate">
                            {attachment.download_url ? (
                              <a
                                href={attachment.download_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[var(--app-primary)] hover:underline"
                              >
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
                  </DetailSection>
                </div>
              </div>
            </div>

            <Group className="shrink-0 border-t border-[var(--app-border)] pt-3">
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
          </>
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

/** True when the rich-text details hold any text, image or list item. */
function hasContent(task: TaskDetail): boolean {
  if (task.content_text?.trim() || task.description?.trim()) return true;
  return JSON.stringify(task.content ?? {}).includes('"type":"image"');
}

/** A framed block with a tinted header, so each part of the task is easy to tell apart. */
function DetailSection({
  icon,
  title,
  aside,
  children,
}: {
  icon: ReactNode;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]">
      <header className="flex items-center justify-between gap-2 border-b border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2">
        <h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[var(--app-text)]">
          <span className="shrink-0 text-[var(--app-primary)]">{icon}</span>
          <span className="truncate">{title}</span>
        </h3>
        {aside}
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}

function Property({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-2">
      <dt className="text-xs font-medium text-[var(--app-text-muted)]">{label}</dt>
      <dd className="m-0 min-w-0 text-[var(--app-text)]">{children}</dd>
    </div>
  );
}

function Count({ value }: { value: number }) {
  return value ? (
    <span className="rounded-full bg-[var(--app-surface)] px-2 py-0.5 text-xs font-semibold text-[var(--app-text-muted)]">
      {value}
    </span>
  ) : null;
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

function BackIcon() {
  return (
    <Icon>
      <path d="M15 18l-6-6 6-6" />
    </Icon>
  );
}

function DetailsIcon() {
  return (
    <Icon>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M9 12h7M9 16h7M9 8h3" />
    </Icon>
  );
}

function SubtasksIcon() {
  return (
    <Icon>
      <path d="M4 6l1.5 1.5L8 5M4 13l1.5 1.5L8 12M11 6.5h9M11 13.5h9M11 20h9M6 18v2" />
    </Icon>
  );
}

function PropertiesIcon() {
  return (
    <Icon>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </Icon>
  );
}

function LinkIcon() {
  return (
    <Icon>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </Icon>
  );
}

function FileIcon() {
  return (
    <Icon>
      <path d="M20 11.5l-8.2 8.2a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8" />
    </Icon>
  );
}
