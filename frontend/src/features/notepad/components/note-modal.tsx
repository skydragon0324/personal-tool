import {
  Button,
  Checkbox,
  Group,
  Modal,
  Select,
  Stack,
  TextInput,
  Textarea,
} from "@mantine/core";
import { useEffect, useMemo, useState } from "react";

import { DiscardChangesModal } from "@/components/discard-changes-modal";

import type { Note, NoteCreate, NotePriority, NoteUpdate } from "../types";
import { t } from "@/i18n";

interface NoteDraft {
  title: string;
  body: string;
  priority: NotePriority | null;
  is_pinned: boolean;
}

const EMPTY_DRAFT: NoteDraft = {
  title: "",
  body: "",
  priority: null,
  is_pinned: false,
};

function priorityOptions() {
  return [
    { value: "none", label: t("notes.none") },
    { value: "low", label: t("task.priorityLow") },
    { value: "medium", label: t("task.priorityMedium") },
    { value: "high", label: t("task.priorityHigh") },
  ];
}

interface NoteModalProps {
  opened: boolean;
  note: Note | null;
  submitting?: boolean;
  onClose: () => void;
  onCreate: (payload: NoteCreate) => Promise<void>;
  onUpdate: (noteId: string, payload: NoteUpdate) => Promise<void>;
  onDelete: (note: Note) => void;
}

export function NoteModal({
  opened,
  note,
  submitting,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: NoteModalProps) {
  const [draft, setDraft] = useState<NoteDraft>(EMPTY_DRAFT);
  const [discardOpen, setDiscardOpen] = useState(false);

  const baseline = useMemo<NoteDraft>(
    () =>
      note
        ? {
            title: note.title,
            body: note.body,
            priority: note.priority,
            is_pinned: note.is_pinned,
          }
        : EMPTY_DRAFT,
    [note],
  );

  useEffect(() => {
    if (opened) {
      setDraft(baseline);
      setDiscardOpen(false);
    }
  }, [baseline, opened, note?.id]);

  const dirty =
    draft.title !== baseline.title ||
    draft.body !== baseline.body ||
    draft.priority !== baseline.priority ||
    draft.is_pinned !== baseline.is_pinned;

  const canSave = draft.title.trim().length > 0;

  function requestClose() {
    if (dirty) {
      setDiscardOpen(true);
      return;
    }
    onClose();
  }

  async function handleSave() {
    const title = draft.title.trim();
    if (!title) return;
    if (note) {
      await onUpdate(note.id, {
        title,
        body: draft.body,
        priority: draft.priority,
        is_pinned: draft.is_pinned,
      });
    } else {
      await onCreate({
        title,
        body: draft.body,
        priority: draft.priority,
        is_pinned: draft.is_pinned,
      });
    }
  }

  return (
    <>
      <Modal
        opened={opened}
        onClose={requestClose}
        size="lg"
        radius="lg"
        title={note ? t("notes.editNote") : t("notes.newNote")}
      >
        <Stack gap="md">
          <TextInput
            label={t("notes.title")}
            required
            value={draft.title}
            onChange={(event) => {
              const title = event.currentTarget.value;
              setDraft((current) => ({ ...current, title }));
            }}
            placeholder={t("notes.titlePlaceholder")}
          />
          <Textarea
            label={t("notes.body")}
            minRows={10}
            autosize
            value={draft.body}
            onChange={(event) => {
              const body = event.currentTarget.value;
              setDraft((current) => ({ ...current, body }));
            }}
            placeholder={t("notes.bodyPlaceholder")}
          />
          <Select
            label={t("notes.priority")}
            data={priorityOptions()}
            value={draft.priority ?? "none"}
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                priority: value === "none" || !value ? null : (value as NotePriority),
              }))
            }
            allowDeselect={false}
          />
          <Checkbox
            label={t("notes.pinned")}
            checked={draft.is_pinned}
            onChange={(event) => {
              const isPinned = event.currentTarget.checked;
              setDraft((current) => ({ ...current, is_pinned: isPinned }));
            }}
          />
          <Group justify="space-between" mt="sm">
            {note ? (
              <Button color="red" variant="light" onClick={() => onDelete(note)}>
                {t("common.delete")}
              </Button>
            ) : (
              <span />
            )}
            <Group>
              <Button variant="default" onClick={requestClose}>
                {t("common.cancel")}
              </Button>
              <Button onClick={() => void handleSave()} disabled={!canSave} loading={submitting}>
                {t("common.save")}
              </Button>
            </Group>
          </Group>
        </Stack>
      </Modal>
      <DiscardChangesModal
        opened={discardOpen}
        onKeepEditing={() => setDiscardOpen(false)}
        onDiscard={() => {
          setDiscardOpen(false);
          onClose();
        }}
      />
    </>
  );
}
