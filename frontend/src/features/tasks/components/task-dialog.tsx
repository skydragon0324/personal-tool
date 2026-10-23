import { Modal, Loader, Alert, Center } from "@mantine/core";
import { useEffect, useState } from "react";

import { DiscardChangesModal } from "@/components/discard-changes-modal";

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
  const [dirty, setDirty] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => {
    if (!open) {
      setDirty(false);
      setConfirmDiscard(false);
    }
  }, [open]);

  // Closing (X, outside click, Escape or Cancel) asks first when there are unsaved edits.
  function requestClose() {
    if (dirty) setConfirmDiscard(true);
    else onClose();
  }

  return (
    <>
      <Modal
        opened={open}
        onClose={requestClose}
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
          // One scroll area: the modal is a fixed-height column and the form scrolls inside it.
          content: "max-w-4xl w-[min(96vw,56rem)] !flex flex-col !overflow-hidden",
          body: "flex min-h-0 flex-1 flex-col p-0 sm:p-1",
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
              <div className="flex min-h-0 flex-1 flex-col px-1 pb-2 sm:px-2">
                <TaskForm
                  key={`${initial?.id ?? "new"}-${columnId}-${dueDate}`}
                  initial={initial}
                  boardId={boardId}
                  columnId={columnId}
                  dueDate={dueDate}
                  submitting={submitting}
                  onSubmit={onSubmit}
                  onCancel={requestClose}
                  onDirtyChange={setDirty}
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
      <DiscardChangesModal
        opened={confirmDiscard}
        onKeepEditing={() => setConfirmDiscard(false)}
        onDiscard={() => {
          setConfirmDiscard(false);
          setDirty(false);
          onClose();
        }}
      />
    </>
  );
}
