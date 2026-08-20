"use client";

import { move } from "@dnd-kit/helpers";
import { ActionIcon, Button, Checkbox, Group, Text, TextInput } from "@mantine/core";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { useEffect, useRef, useState } from "react";

import type { BoardQueryParams, TaskSubtask } from "@/features/board/types";
import { moveAnchors } from "@/features/board/utils/move-anchors";
import { subtaskProgressLabel, canAddSubtask, useSubtaskMutations } from "../hooks/use-subtasks";

function SubtaskRow({
  item,
  index,
  onToggle,
  onRename,
  onDelete,
}: {
  item: TaskSubtask;
  index: number;
  onToggle: (checked: boolean) => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const { ref, handleRef } = useSortable({
    id: item.id,
    index,
    type: "subtask",
    accept: "subtask",
    group: "subtasks",
  });
  const [title, setTitle] = useState(item.title);

  useEffect(() => {
    setTitle(item.title);
  }, [item.title]);

  return (
    <div
      ref={ref}
      className="flex items-center gap-2 rounded-lg border border-[var(--app-border)] px-2 py-1.5"
    >
      <button
        type="button"
        ref={handleRef}
        aria-label={`Reorder ${item.title}`}
        className="cursor-grab text-[var(--app-text-muted)]"
      >
        ⋮⋮
      </button>
      <Checkbox
        checked={item.is_completed}
        onChange={(event) => onToggle(event.currentTarget.checked)}
      />
      <TextInput
        className="flex-1"
        variant="unstyled"
        value={title}
        onChange={(event) => setTitle(event.currentTarget.value)}
        onBlur={() => {
          if (title.trim() && title.trim() !== item.title) onRename(title.trim());
        }}
      />
      <ActionIcon variant="subtle" color="red" aria-label="Delete subtask" onClick={onDelete}>
        ×
      </ActionIcon>
    </div>
  );
}

export function SubtaskList({
  taskId,
  query,
  subtasks,
}: {
  taskId: string;
  query: BoardQueryParams;
  subtasks: TaskSubtask[];
}) {
  const { create, update, remove, reorder } = useSubtaskMutations(taskId, query);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState(subtasks);
  const itemsRef = useRef(items);
  const creatingRef = useRef(false);

  useEffect(() => {
    setItems(subtasks);
    itemsRef.current = subtasks;
  }, [subtasks]);

  async function handleCreate() {
    const title = draft.trim();
    if (!canAddSubtask(title, create.isPending || creatingRef.current) || !taskId) return;
    creatingRef.current = true;
    setError(null);
    try {
      await create.mutateAsync(title);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add subtask");
    } finally {
      creatingRef.current = false;
    }
  }

  const addDisabled = !canAddSubtask(draft, create.isPending || creatingRef.current) || !taskId;

  return (
    <section className="space-y-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 className="font-medium text-[var(--app-text)]">Subtasks</h3>
          <Text size="xs" c="dimmed">
            Separate from the checklist in the description.
          </Text>
        </div>
        {subtasks.length ? (
          <p className="text-xs text-[var(--app-text-muted)]">{subtaskProgressLabel(subtasks)}</p>
        ) : null}
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {create.isPending ? <p className="text-xs text-[var(--app-text-muted)]">Saving…</p> : null}
      {!items.length ? (
        <p className="text-sm text-[var(--app-text-muted)]">No subtasks yet.</p>
      ) : (
        <DragDropProvider
          onDragOver={(event) => {
            if (event.operation.source?.type !== "subtask") return;
            setItems((current) => {
              const lookup = new Map(current.map((item) => [item.id, item]));
              const nextIds = move({ subtasks: current.map((item) => item.id) }, event) as {
                subtasks: string[];
              };
              const next = nextIds.subtasks
                .map((id) => lookup.get(id))
                .filter((item): item is TaskSubtask => Boolean(item));
              itemsRef.current = next;
              return next;
            });
          }}
          onDragEnd={async (event) => {
            const sourceId = String(event.operation.source?.id ?? "");
            if (!sourceId || event.canceled) return;
            const anchors = moveAnchors(itemsRef.current, sourceId);
            try {
              await reorder.mutateAsync({
                subtask_id: sourceId,
                after_subtask_id: anchors.after_task_id,
                before_subtask_id: anchors.before_task_id,
              });
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not reorder subtasks");
              setItems(subtasks);
              itemsRef.current = subtasks;
            }
          }}
        >
          <div className="space-y-2">
            {items.map((item, index) => (
              <SubtaskRow
                key={item.id}
                item={item}
                index={index}
                onToggle={(is_completed) =>
                  void update.mutateAsync({ subtaskId: item.id, payload: { is_completed } })
                }
                onRename={(title) => void update.mutateAsync({ subtaskId: item.id, payload: { title } })}
                onDelete={() => void remove.mutateAsync(item.id)}
              />
            ))}
          </div>
        </DragDropProvider>
      )}
      <Group align="center" wrap="nowrap" gap="sm">
        <TextInput
          className="flex-1"
          placeholder="Add a subtask"
          aria-label="Add a subtask"
          value={draft}
          disabled={!taskId || create.isPending}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void handleCreate();
            }
          }}
        />
        <Button
          type="button"
          onClick={() => void handleCreate()}
          disabled={addDisabled}
          loading={create.isPending}
        >
          Add
        </Button>
      </Group>
    </section>
  );
}
