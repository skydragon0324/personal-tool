import { move } from "@dnd-kit/helpers";
import { ActionIcon, Button, Checkbox, Group, Text, TextInput } from "@mantine/core";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { useEffect, useRef, useState } from "react";

import { AssigneeAvatars } from "@/features/board/components/assignee-avatars";
import type { BoardQueryParams, TaskSubtask } from "@/features/board/types";
import { moveAnchors } from "@/features/board/utils/move-anchors";
import { formatDisplayDate } from "@/lib/dates";
import { canAddSubtask, useSubtaskMutations } from "../hooks/use-subtasks";
import { PriorityBadge } from "./priority-badge";
import { t } from "@/i18n";

function SubtaskRow({
  item,
  index,
  onToggle,
  onOpen,
  onDelete,
}: {
  item: TaskSubtask;
  index: number;
  onToggle: (checked: boolean) => void;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const { ref, handleRef } = useSortable({
    id: item.id,
    index,
    type: "subtask",
    accept: "subtask",
    group: "subtasks",
  });

  return (
    <div
      ref={ref}
      className="flex items-center gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-1.5"
    >
      <button
        type="button"
        ref={handleRef}
        aria-label={t("tasks.reorderItem", { title: item.title })}
        className="cursor-grab text-[var(--app-text-muted)]"
      >
        ⋮⋮
      </button>
      <Checkbox
        aria-label={
          item.is_completed
            ? t("tasks.markNotDone", { title: item.title })
            : t("tasks.markDone", { title: item.title })
        }
        checked={item.is_completed}
        onChange={(event) => onToggle(event.currentTarget.checked)}
      />
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-[var(--app-surface-muted)]"
      >
        <span
          className={`min-w-0 flex-1 truncate text-sm ${
            item.is_completed ? "text-[var(--app-text-muted)] line-through" : "text-[var(--app-text)]"
          }`}
        >
          {item.title}
        </span>
        <span className="hidden shrink-0 text-xs text-[var(--app-text-muted)] sm:inline">
          {formatDisplayDate(item.due_date)}
        </span>
        <PriorityBadge priority={item.priority} />
        {item.assignees?.length ? <AssigneeAvatars people={item.assignees} size={20} max={3} /> : null}
      </button>
      <ActionIcon variant="subtle" color="red" aria-label={t("tasks.deleteItem", { title: item.title })} onClick={onDelete}>
        ×
      </ActionIcon>
    </div>
  );
}

export function SubtaskList({
  taskId,
  query,
  subtasks,
  onOpen,
  onDelete,
}: {
  taskId: string;
  query: BoardQueryParams;
  subtasks: TaskSubtask[];
  /** Open a sub-task as a full task. */
  onOpen: (subtaskId: string) => void;
  onDelete: (subtask: TaskSubtask) => void;
}) {
  const { create, update, reorder } = useSubtaskMutations(taskId, query);
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
      setError(err instanceof Error ? err.message : t("tasks.couldNotAddSubtask"));
    } finally {
      creatingRef.current = false;
    }
  }

  const addDisabled = !canAddSubtask(draft, create.isPending || creatingRef.current) || !taskId;

  return (
    // The surrounding section supplies the frame, heading and progress count.
    <div className="space-y-3">
      <Text size="xs" c="dimmed">
        {t("tasks.subtasksHint")}
      </Text>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {create.isPending ? <p className="text-xs text-[var(--app-text-muted)]">{t("common.saving")}</p> : null}
      {!items.length ? (
        <p className="text-sm text-[var(--app-text-muted)]">{t("tasks.noSubtasks")}</p>
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
              setError(err instanceof Error ? err.message : t("tasks.couldNotReorderSubtasks"));
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
                  void update
                    .mutateAsync({ subtaskId: item.id, payload: { is_completed } })
                    .catch((err) => setError(err instanceof Error ? err.message : t("tasks.couldNotUpdateSubtask")))
                }
                onOpen={() => onOpen(item.id)}
                onDelete={() => onDelete(item)}
              />
            ))}
          </div>
        </DragDropProvider>
      )}
      <Group align="center" wrap="nowrap" gap="sm">
        <TextInput
          className="flex-1"
          placeholder={t("tasks.addSubtask")}
          aria-label={t("tasks.addSubtask")}
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
          {t("common.add")}
        </Button>
      </Group>
    </div>
  );
}
