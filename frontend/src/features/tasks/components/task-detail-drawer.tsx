"use client";

import { Alert, Button, Drawer, Group, Loader, Menu, Stack, Text } from "@mantine/core";
import { useEffect, useState } from "react";

import type {
  BoardColumn,
  BoardQueryParams,
  TaskCreate,
  TaskDetail,
  TiptapJSON,
} from "@/features/board/types";
import { useTaskDetail } from "@/features/board/hooks/use-task-detail";
import { CategoryBadge } from "./category-badge";
import { PriorityBadge } from "./priority-badge";
import { SubtaskList } from "./subtask-list";
import { TaskContentViewer } from "./task-content-viewer";
import { TaskForm } from "./task-form";
import { formatDateTime, formatTaskPeriod } from "@/lib/dates";

interface TaskDetailDrawerProps {
  taskId: string | null;
  mode: "view" | "edit";
  boardId: string;
  query: BoardQueryParams;
  columns: BoardColumn[];
  submitting?: boolean;
  onModeChange: (mode: "view" | "edit") => void;
  onClose: () => void;
  onSubmit: (payload: TaskCreate, pendingFiles: File[], existingId?: string) => Promise<TaskDetail>;
  onUploadFile?: (taskId: string, file: File) => Promise<{ download_url: string | null }>;
  onPatchContent?: (taskId: string, content: TiptapJSON) => Promise<void>;
  onDeleteAttachment?: (attachmentId: string) => Promise<void>;
  onDelete: (taskId: string, title: string) => void;
}

export function TaskDetailDrawer({
  taskId,
  mode,
  boardId,
  query,
  columns,
  submitting,
  onModeChange,
  onClose,
  onSubmit,
  onUploadFile,
  onPatchContent,
  onDeleteAttachment,
  onDelete,
}: TaskDetailDrawerProps) {
  const detailQuery = useTaskDetail(taskId);
  const task = detailQuery.data ?? null;
  const [localMode, setLocalMode] = useState(mode);

  useEffect(() => {
    setLocalMode(mode);
  }, [mode, taskId]);

  const statusName = columns.find((column) => column.id === task?.column_id)?.name ?? "Unknown";

  return (
    <Drawer
      opened={taskId !== null}
      onClose={onClose}
      position="right"
      size="lg"
      title={localMode === "edit" ? "Edit task" : "Task details"}
    >
      {detailQuery.isLoading ? (
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      ) : null}
      {detailQuery.isError ? (
        <Alert color="red">
          {detailQuery.error instanceof Error ? detailQuery.error.message : "Failed to load task"}
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
          onCancel={() => {
            setLocalMode("view");
            onModeChange("view");
          }}
          onUploadFile={onUploadFile}
          onPatchContent={onPatchContent}
          onDeleteAttachment={onDeleteAttachment}
        />
      ) : null}
      {task && localMode === "view" ? (
        <Stack gap="md">
          <div>
            <h2 className="font-display text-2xl text-[var(--app-text)]">{task.title}</h2>
            <Text size="sm" c="dimmed" mt={4}>
              Status: {statusName}
            </Text>
          </div>
          <Group>
            <CategoryBadge category={task.category} />
            <PriorityBadge priority={task.priority} />
          </Group>
          <Text size="sm">{formatTaskPeriod(task.start_date, task.due_date)}</Text>
          <Text size="xs" c="dimmed">
            Created {formatDateTime(task.created_at)} · Updated {formatDateTime(task.updated_at)}
          </Text>
          <TaskContentViewer value={task.content} />
          <SubtaskList taskId={task.id} query={query} subtasks={task.subtasks ?? []} />
          <section>
            <h3 className="mb-2 font-medium">Reference links</h3>
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
                No reference links.
              </Text>
            )}
          </section>
          <section>
            <h3 className="mb-2 font-medium">Attachments</h3>
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
                No files.
              </Text>
            )}
          </section>
          <Group>
            <Button onClick={() => setLocalMode("edit")}>Edit</Button>
            <Menu>
              <Menu.Target>
                <Button variant="default">More</Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item color="red" onClick={() => onDelete(task.id, task.title)}>
                  Delete
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Stack>
      ) : null}
    </Drawer>
  );
}
