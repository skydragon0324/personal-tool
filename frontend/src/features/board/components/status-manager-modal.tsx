"use client";

import { move } from "@dnd-kit/helpers";
import { CollisionPriority } from "@dnd-kit/abstract";
import { DragDropProvider } from "@dnd-kit/react";
import { useDroppable } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import {
  Badge,
  Button,
  Checkbox,
  Group,
  Modal,
  Select,
  Stack,
  Tabs,
  Text,
  TextInput,
} from "@mantine/core";
import { useEffect, useMemo, useRef, useState } from "react";

import { notifyApiError, notifySuccess } from "@/lib/notify";
import { formatDateTime } from "@/lib/dates";
import type { ColumnDetail } from "../types";
import { STATUS_COLORS, statusHeaderClass } from "../utils/status-colors";
import { useColumnMutations, useColumns } from "../hooks/use-columns";

interface StatusManagerModalProps {
  opened: boolean;
  onClose: () => void;
  boardId: string;
  initialTab?: "active" | "archived";
}

function SortableStatusRow({
  column,
  index,
  onRename,
  onColor,
  onDone,
  onRequestArchive,
}: {
  column: ColumnDetail;
  index: number;
  onRename: (name: string) => void;
  onColor: (color: string) => void;
  onDone: (isDone: boolean) => void;
  onRequestArchive: () => void;
}) {
  const { ref, handleRef } = useSortable({
    id: column.id,
    index,
    type: "status",
    accept: "status",
    group: "statuses",
  });
  const [name, setName] = useState(column.name);

  useEffect(() => {
    setName(column.name);
  }, [column.name]);

  return (
    <div
      ref={ref}
      className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3"
    >
      <div className="flex flex-wrap items-start gap-3">
        <button
          type="button"
          ref={handleRef}
          className="mt-1 cursor-grab rounded-md border border-[var(--app-border)] px-2 py-1 text-[var(--app-text-muted)]"
          aria-label={`Reorder ${column.name}`}
        >
          ⋮⋮
        </button>
        <div className={`mt-1 h-8 w-1.5 rounded-full ${statusHeaderClass(column.color)}`} />
        <div className="min-w-0 flex-1 space-y-2">
          <TextInput
            label="Name"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            onBlur={() => {
              if (name.trim() && name.trim() !== column.name) onRename(name.trim());
            }}
          />
          <Group gap="xs">
            {STATUS_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={`h-6 w-6 rounded-full ${statusHeaderClass(color)} ${
                  column.color === color ? "ring-2 ring-[var(--app-primary)] ring-offset-2" : ""
                }`}
                onClick={() => onColor(color)}
                aria-label={color}
              />
            ))}
          </Group>
          <Checkbox
            label="Counts as completed"
            description="Tasks in this status are counted as completed."
            checked={column.is_done}
            onChange={(event) => onDone(event.currentTarget.checked)}
          />
          <Button size="xs" color="red" variant="light" onClick={onRequestArchive}>
            Archive status
          </Button>
          <Text size="xs" c="dimmed">
            Archiving hides this status from the board. Existing tasks must be moved to another
            status.
          </Text>
        </div>
      </div>
    </div>
  );
}

function StatusList({ children }: { children: React.ReactNode }) {
  const { ref } = useDroppable({
    id: "statuses",
    type: "column",
    accept: "status",
    collisionPriority: CollisionPriority.Low,
  });
  return (
    <div ref={ref} className="space-y-3">
      {children}
    </div>
  );
}

export function StatusManagerModal({
  opened,
  onClose,
  boardId,
  initialTab = "active",
}: StatusManagerModalProps) {
  const columnsQuery = useColumns(boardId, true);
  const { create, update, reorder, archive, restore, remove } = useColumnMutations(boardId);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("slate");
  const [newDone, setNewDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingArchive, setPendingArchive] = useState<ColumnDetail | null>(null);
  const [archiveMoveTo, setArchiveMoveTo] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ColumnDetail | null>(null);
  const [deleteName, setDeleteName] = useState("");
  const [tab, setTab] = useState<"active" | "archived">(initialTab);

  useEffect(() => {
    if (opened) {
      setTab(initialTab);
      setDeleteName("");
      setPendingDelete(null);
    }
  }, [opened, initialTab]);

  const active = useMemo(
    () =>
      (columnsQuery.data ?? [])
        .filter((column) => !column.archived_at)
        .sort((a, b) => a.position - b.position),
    [columnsQuery.data],
  );
  const archived = useMemo(
    () => (columnsQuery.data ?? []).filter((column) => column.archived_at),
    [columnsQuery.data],
  );
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const orderedRef = useRef(orderedIds);

  useEffect(() => {
    const ids = active.map((column) => column.id);
    setOrderedIds(ids);
    orderedRef.current = ids;
  }, [active]);

  const orderedColumns = orderedIds
    .map((id) => active.find((column) => column.id === id))
    .filter((column): column is ColumnDetail => Boolean(column));

  async function handleCreate() {
    if (!newName.trim()) return;
    setError(null);
    try {
      await create.mutateAsync({
        name: newName.trim(),
        color: newColor,
        is_done: newDone,
      });
      setNewName("");
      setNewDone(false);
      notifySuccess("Status created");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not create status";
      setError(message);
      notifyApiError(err, "Could not create status");
    }
  }

  function openArchiveDialog(column: ColumnDetail) {
    const fallback = active.find((item) => item.id !== column.id)?.id ?? null;
    setArchiveMoveTo(fallback);
    setPendingArchive(column);
  }

  async function confirmArchive() {
    if (!pendingArchive) return;
    if (pendingArchive.task_count > 0 && !archiveMoveTo) return;
    setError(null);
    try {
      await archive.mutateAsync({
        columnId: pendingArchive.id,
        moveToColumnId: pendingArchive.task_count > 0 ? archiveMoveTo : null,
      });
      notifySuccess(`Archived ${pendingArchive.name}`);
      setPendingArchive(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not archive status";
      setError(message);
      notifyApiError(err, "Could not archive status");
    }
  }

  async function handleRestore(column: ColumnDetail) {
    setError(null);
    try {
      await restore.mutateAsync(column.id);
      notifySuccess(`Restored ${column.name}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not restore status";
      setError(message);
      notifyApiError(err, "Could not restore status");
    }
  }

  async function confirmDelete() {
    if (!pendingDelete || deleteName !== pendingDelete.name) return;
    setError(null);
    try {
      await remove.mutateAsync(pendingDelete.id);
      notifySuccess(`Deleted ${pendingDelete.name}`);
      setPendingDelete(null);
      setDeleteName("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not delete status";
      setError(message);
      notifyApiError(err, "Could not delete status");
    }
  }

  const archiveTargetName = active.find((column) => column.id === archiveMoveTo)?.name;

  return (
    <>
      <Modal
        opened={opened}
        onClose={onClose}
        title="Manage statuses"
        size="xl"
        radius="lg"
        styles={{ body: { maxHeight: "min(75vh, 720px)", overflowY: "auto" } }}
      >
        <Stack>
          {error ? (
            <Text size="sm" c="red">
              {error}
            </Text>
          ) : null}
          <Tabs value={tab} onChange={(value) => value && setTab(value as "active" | "archived")}>
            <Tabs.List>
              <Tabs.Tab value="active">Active ({active.length})</Tabs.Tab>
              <Tabs.Tab value="archived">Archived ({archived.length})</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="active" pt="md">
              <div className="rounded-xl border border-dashed border-[var(--app-border)] p-3">
                <Text fw={600} mb="xs">
                  Add a status
                </Text>
                <Group align="end" grow>
                  <TextInput
                    label="Name"
                    value={newName}
                    onChange={(event) => setNewName(event.currentTarget.value)}
                    placeholder="e.g. Review"
                  />
                  <Select
                    label="Color"
                    data={STATUS_COLORS.map((color) => ({ value: color, label: color }))}
                    value={newColor}
                    onChange={(value) => setNewColor(value ?? "slate")}
                    allowDeselect={false}
                  />
                </Group>
                <Checkbox
                  className="mt-3"
                  label="Counts as completed"
                  description="Tasks in this status are counted as completed."
                  checked={newDone}
                  onChange={(event) => setNewDone(event.currentTarget.checked)}
                />
                <Button className="mt-3" onClick={() => void handleCreate()} loading={create.isPending}>
                  Add
                </Button>
              </div>

              <Text fw={600} mt="lg" mb="sm">
                Active statuses
              </Text>
              <DragDropProvider
                onDragOver={(event) => {
                  if (event.operation.source?.type === "column") return;
                  setOrderedIds((current) => {
                    const next = move({ statuses: current }, event) as { statuses: string[] };
                    orderedRef.current = next.statuses;
                    return next.statuses;
                  });
                }}
                onDragEnd={async (event) => {
                  const sourceId = String(event.operation.source?.id ?? "");
                  if (!sourceId || event.canceled) return;
                  const target = orderedRef.current.indexOf(sourceId);
                  const original = active.findIndex((column) => column.id === sourceId);
                  if (target < 0 || original < 0 || target === original) return;
                  try {
                    await reorder.mutateAsync({ columnId: sourceId, targetPosition: target });
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Could not reorder statuses");
                    notifyApiError(err, "Could not reorder statuses");
                    setOrderedIds(active.map((column) => column.id));
                  }
                }}
              >
                <StatusList>
                  {orderedColumns.map((column, index) => (
                    <SortableStatusRow
                      key={column.id}
                      column={column}
                      index={index}
                      onRename={(name) =>
                        void update.mutateAsync({ columnId: column.id, payload: { name } })
                      }
                      onColor={(color) =>
                        void update.mutateAsync({ columnId: column.id, payload: { color } })
                      }
                      onDone={(is_done) =>
                        void update.mutateAsync({ columnId: column.id, payload: { is_done } })
                      }
                      onRequestArchive={() => openArchiveDialog(column)}
                    />
                  ))}
                </StatusList>
              </DragDropProvider>
            </Tabs.Panel>

            <Tabs.Panel value="archived" pt="md">
              <Text size="sm" c="dimmed" mb="md">
                Archive is reversible. Delete permanently cannot be undone.
              </Text>
              {archived.length ? (
                <div className="space-y-3">
                  {archived.map((column) => (
                    <div
                      key={column.id}
                      className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4"
                    >
                      <Group justify="space-between" align="flex-start">
                        <div>
                          <Group gap="sm" mb={6}>
                            <span
                              className={`h-3 w-3 rounded-full ${statusHeaderClass(column.color)}`}
                            />
                            <Text fw={600}>{column.name}</Text>
                          </Group>
                          <Text size="sm" c="dimmed">
                            Archived {column.archived_at ? formatDateTime(column.archived_at) : ""}
                          </Text>
                          <Badge className="mt-2" variant="light" color={column.is_done ? "teal" : "gray"}>
                            {column.is_done ? "Counts as completed" : "Not a completed status"}
                          </Badge>
                        </div>
                        <Group gap="xs">
                          <Button
                            variant="light"
                            onClick={() => void handleRestore(column)}
                            loading={restore.isPending && restore.variables === column.id}
                            disabled={restore.isPending || remove.isPending}
                          >
                            Restore
                          </Button>
                          <Button
                            color="red"
                            variant="light"
                            onClick={() => {
                              setPendingDelete(column);
                              setDeleteName("");
                            }}
                            disabled={column.task_count > 0 || remove.isPending}
                          >
                            Delete permanently
                          </Button>
                        </Group>
                      </Group>
                      {column.task_count > 0 ? (
                        <Text size="xs" c="dimmed" mt="xs">
                          Move or delete its tasks before permanent deletion.
                        </Text>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <Text size="sm" c="dimmed">
                  No archived statuses.
                </Text>
              )}
            </Tabs.Panel>
          </Tabs>
        </Stack>
      </Modal>

      <Modal
        opened={pendingArchive !== null}
        onClose={() => setPendingArchive(null)}
        title="Archive status"
        radius="lg"
      >
        {pendingArchive ? (
          <Stack>
            <Text>
              Archive <strong>{pendingArchive.name}</strong>? It will be hidden from the board and
              can be restored later.
            </Text>
            {pendingArchive.task_count > 0 ? (
              <>
                <Text size="sm">
                  {pendingArchive.task_count}{" "}
                  {pendingArchive.task_count === 1 ? "task" : "tasks"} will move to the selected
                  status
                  {archiveTargetName ? ` (${archiveTargetName})` : ""}.
                </Text>
                <Select
                  label="Move tasks to"
                  data={active
                    .filter((item) => item.id !== pendingArchive.id)
                    .map((item) => ({ value: item.id, label: item.name }))}
                  value={archiveMoveTo}
                  onChange={setArchiveMoveTo}
                  placeholder="Target status"
                />
              </>
            ) : (
              <Text size="sm" c="dimmed">
                This status has no tasks.
              </Text>
            )}
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setPendingArchive(null)}>
                Cancel
              </Button>
              <Button
                color="red"
                onClick={() => void confirmArchive()}
                loading={archive.isPending}
                disabled={pendingArchive.task_count > 0 && !archiveMoveTo}
              >
                Archive status
              </Button>
            </Group>
          </Stack>
        ) : null}
      </Modal>

      <Modal
        opened={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Delete status permanently"
        radius="lg"
      >
        {pendingDelete ? (
          <Stack>
            <Text>
              Permanently delete <strong>{pendingDelete.name}</strong>? This action cannot be undone.
            </Text>
            <TextInput
              label="Type the status name to confirm"
              value={deleteName}
              onChange={(event) => setDeleteName(event.currentTarget.value)}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setPendingDelete(null)}>
                Cancel
              </Button>
              <Button
                color="red"
                onClick={() => void confirmDelete()}
                loading={remove.isPending}
                disabled={deleteName !== pendingDelete.name}
              >
                Delete permanently
              </Button>
            </Group>
          </Stack>
        ) : null}
      </Modal>
    </>
  );
}
