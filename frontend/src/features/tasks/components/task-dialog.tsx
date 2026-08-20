"use client";

import { Modal, Loader, Alert, Center } from "@mantine/core";

import type { TaskCreate, TaskDetail, TiptapJSON } from "@/features/board/types";
import { TaskForm } from "./task-form";

interface TaskDialogProps {
  open: boolean;
  title: string;
  boardId: string;
  initial?: TaskDetail | null;
  columnId: string;
  dueDate: string;
  submitting?: boolean;
  loadingDetail?: boolean;
  detailError?: string | null;
  onClose: () => void;
  onSubmit: (payload: TaskCreate, pendingFiles: File[], existingId?: string) => Promise<TaskDetail>;
  onUploadFile?: (taskId: string, file: File) => Promise<{ download_url: string | null }>;
  onPatchContent?: (taskId: string, content: TiptapJSON) => Promise<void>;
  onDeleteAttachment?: (attachmentId: string) => Promise<void>;
  uploading?: boolean;
}

export function TaskDialog({
  open,
  title,
  boardId,
  initial,
  columnId,
  dueDate,
  submitting,
  loadingDetail,
  detailError,
  onClose,
  onSubmit,
  onUploadFile,
  onPatchContent,
  onDeleteAttachment,
  uploading,
}: TaskDialogProps) {
  return (
    <Modal
      opened={open}
      onClose={onClose}
      title={title}
      size="xl"
      radius="lg"
      padding="lg"
      returnFocus={false}
      lockScroll
      closeOnClickOutside
      closeOnEscape
      trapFocus={false}
      transitionProps={{ duration: 120 }}
      classNames={{
        content: "max-w-4xl w-[min(96vw,56rem)]",
        body: "p-0 sm:p-1",
      }}
    >
      {open ? (
        <>
          {loadingDetail ? (
            <Center py="xl">
              <Loader />
            </Center>
          ) : null}
          {detailError ? (
            <Alert color="red" m="md">
              {detailError}
            </Alert>
          ) : null}
          {!loadingDetail && !detailError ? (
            <div className="px-1 pb-2 sm:px-2">
              <TaskForm
                key={`${initial?.id ?? "new"}-${columnId}-${dueDate}`}
                initial={initial}
                boardId={boardId}
                columnId={columnId}
                dueDate={dueDate}
                submitting={submitting}
                onSubmit={onSubmit}
                onCancel={onClose}
                onUploadFile={onUploadFile}
                onPatchContent={onPatchContent}
                onDeleteAttachment={onDeleteAttachment}
                uploading={uploading}
              />
            </div>
          ) : null}
        </>
      ) : null}
    </Modal>
  );
}
