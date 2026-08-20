"use client";

import {
  Button,
  Checkbox,
  Drawer,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
} from "@mantine/core";
import { useEffect, useMemo, useState } from "react";

import type { Note, NoteCreate, NotePriority, NoteUpdate } from "../types";

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

const PRIORITY_OPTIONS = [
  { value: "none", label: "None" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

interface NoteDrawerProps {
  opened: boolean;
  note: Note | null;
  submitting?: boolean;
  onClose: () => void;
  onCreate: (payload: NoteCreate) => Promise<void>;
  onUpdate: (noteId: string, payload: NoteUpdate) => Promise<void>;
  onDelete: (note: Note) => void;
}

export function NoteDrawer({
  opened,
  note,
  submitting,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: NoteDrawerProps) {
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
      <Drawer
        opened={opened}
        onClose={requestClose}
        position="right"
        size="lg"
        title={note ? "Edit note" : "New note"}
      >
        <Stack gap="md">
          <TextInput
            label="Title"
            required
            value={draft.title}
            onChange={(event) => {
              const title = event.currentTarget.value;
              setDraft((current) => ({ ...current, title }));
            }}
            placeholder="Note title"
          />
          <Textarea
            label="Body"
            minRows={10}
            autosize
            value={draft.body}
            onChange={(event) => {
              const body = event.currentTarget.value;
              setDraft((current) => ({ ...current, body }));
            }}
            placeholder="Write in plain text"
          />
          <Select
            label="Priority"
            data={PRIORITY_OPTIONS}
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
            label="Pinned"
            checked={draft.is_pinned}
            onChange={(event) => {
              const isPinned = event.currentTarget.checked;
              setDraft((current) => ({ ...current, is_pinned: isPinned }));
            }}
          />
          <Group justify="space-between" mt="sm">
            {note ? (
              <Button color="red" variant="light" onClick={() => onDelete(note)}>
                Delete
              </Button>
            ) : (
              <span />
            )}
            <Group>
              <Button variant="default" onClick={requestClose}>
                Cancel
              </Button>
              <Button onClick={() => void handleSave()} disabled={!canSave} loading={submitting}>
                Save
              </Button>
            </Group>
          </Group>
        </Stack>
      </Drawer>
      <Modal
        opened={discardOpen}
        onClose={() => setDiscardOpen(false)}
        title="Discard changes?"
        radius="lg"
      >
        <Text size="sm" c="dimmed">
          Your edits will be lost.
        </Text>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setDiscardOpen(false)}>
            Keep editing
          </Button>
          <Button
            color="red"
            onClick={() => {
              setDiscardOpen(false);
              onClose();
            }}
          >
            Discard
          </Button>
        </Group>
      </Modal>
    </>
  );
}
