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
  Switch,
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
import { colorName, t } from "@/i18n";
import { tRich } from "@/i18n/rich";

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
          aria-label={t("boards.reorder", { name: column.name })}
        >
          ⋮⋮
        </button>
        <div className={`mt-1 h-8 w-1.5 rounded-full ${statusHeaderClass(column.color)}`} />
        <div className="min-w-0 flex-1 space-y-2">
          <TextInput
            label={t("boards.name")}
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
                aria-label={colorName(color)}
              />
            ))}
          </Group>
          <Group justify="space-between" gap="xs">
            <Switch
              size="sm"
              label={t("status.countsAsCompleted")}
              checked={column.is_done}
              onChange={(event) => onDone(event.currentTarget.checked)}
            />
            <Button size="xs" color="red" variant="subtle" onClick={onRequestArchive}>
              {t("statuses.removeEllipsis")}
            </Button>
          </Group>
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
  const { create, update, reorder, archive, restore, remove, removeMovingTasks } =
    useColumnMutations(boardId);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("slate");
  const [newDone, setNewDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingArchive, setPendingArchive] = useState<ColumnDetail | null>(null);
  const [archiveMoveTo, setArchiveMoveTo] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ColumnDetail | null>(null);
  const [tab, setTab] = useState<"active" | "archived">(initialTab);

  useEffect(() => {
    if (opened) {
      setTab(initialTab);
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
      notifySuccess(t("statuses.created"));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("statuses.couldNotCreate");
      setError(message);
      notifyApiError(err, t("statuses.couldNotCreate"));
    }
  }

  function saveColumn(columnId: string, payload: { name?: string; color?: string; is_done?: boolean }) {
    void update.mutateAsync({ columnId, payload }).catch((error) => {
      notifyApiError(error, t("status.couldNotUpdate"));
    });
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
      notifySuccess(t("statuses.archived", { name: pendingArchive.name }));
      setPendingArchive(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("statuses.couldNotArchive");
      setError(message);
      notifyApiError(err, t("statuses.couldNotArchive"));
    }
  }

  async function deleteNow() {
    if (!pendingArchive) return;
    setError(null);
    try {
      await removeMovingTasks.mutateAsync({
        columnId: pendingArchive.id,
        moveToColumnId: pendingArchive.task_count > 0 ? archiveMoveTo : null,
      });
      notifySuccess(t("status.deleted", { name: pendingArchive.name }));
      setPendingArchive(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("statuses.couldNotDelete"));
      notifyApiError(err, t("statuses.couldNotDelete"));
    }
  }

  async function handleRestore(column: ColumnDetail) {
    setError(null);
    try {
      await restore.mutateAsync(column.id);
      notifySuccess(t("statuses.restored", { name: column.name }));
    } catch (err) {
      const message = err instanceof Error ? err.message : t("statuses.couldNotRestore");
      setError(message);
      notifyApiError(err, t("statuses.couldNotRestore"));
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setError(null);
    try {
      await remove.mutateAsync(pendingDelete.id);
      notifySuccess(t("status.deleted", { name: pendingDelete.name }));
      setPendingDelete(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : t("statuses.couldNotDelete");
      setError(message);
      notifyApiError(err, t("statuses.couldNotDelete"));
    }
  }

  const archiveTargetName = active.find((column) => column.id === archiveMoveTo)?.name;

  return (
    <>
      <Modal
        opened={opened}
        onClose={onClose}
        title={t("board.manageStatuses")}
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
              <Tabs.Tab value="active">{t("boards.activeTab", { count: active.length })}</Tabs.Tab>
              <Tabs.Tab value="archived">{t("boards.archivedTab", { count: archived.length })}</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="active" pt="md">
              <div className="rounded-xl border border-dashed border-[var(--app-border)] p-3">
                <Text fw={600} mb="xs">
                  {t("statuses.addTitle")}
                </Text>
                <Group align="end" grow>
                  <TextInput
                    label={t("boards.name")}
                    value={newName}
                    onChange={(event) => setNewName(event.currentTarget.value)}
                    placeholder={t("statuses.namePlaceholder")}
                  />
                  <Select
                    label={t("status.color")}
                    data={STATUS_COLORS.map((color) => ({ value: color, label: colorName(color) }))}
                    value={newColor}
                    onChange={(value) => setNewColor(value ?? "slate")}
                    allowDeselect={false}
                  />
                </Group>
                <Checkbox
                  className="mt-3"
                  label={t("status.countsAsCompleted")}
                  description={t("statuses.countsAsCompletedHint")}
                  checked={newDone}
                  onChange={(event) => setNewDone(event.currentTarget.checked)}
                />
                <Button className="mt-3" onClick={() => void handleCreate()} loading={create.isPending}>
                  {t("common.add")}
                </Button>
              </div>

              <Text fw={600} mt="lg" mb="sm">
                {t("statuses.activeStatuses")}
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
                    setError(err instanceof Error ? err.message : t("statuses.couldNotReorder"));
                    notifyApiError(err, t("statuses.couldNotReorder"));
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
                      onRename={(name) => saveColumn(column.id, { name })}
                      onColor={(color) => saveColumn(column.id, { color })}
                      onDone={(is_done) => saveColumn(column.id, { is_done })}
                      onRequestArchive={() => openArchiveDialog(column)}
                    />
                  ))}
                </StatusList>
              </DragDropProvider>
            </Tabs.Panel>

            <Tabs.Panel value="archived" pt="md">
              <Text size="sm" c="dimmed" mb="md">
                {t("boards.archiveHint")}
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
                            {t("boards.archivedAt", { date: column.archived_at ? formatDateTime(column.archived_at) : "" })}
                          </Text>
                          <Badge className="mt-2" variant="light" color={column.is_done ? "teal" : "gray"}>
                            {column.is_done ? t("status.countsAsCompleted") : t("statuses.notCompleted")}
                          </Badge>
                        </div>
                        <Group gap="xs">
                          <Button
                            variant="light"
                            onClick={() => void handleRestore(column)}
                            loading={restore.isPending && restore.variables === column.id}
                            disabled={restore.isPending || remove.isPending}
                          >
                            {t("boards.restore")}
                          </Button>
                          <Button
                            color="red"
                            variant="light"
                            onClick={() => {
                              setPendingDelete(column);
                            }}
                            disabled={column.task_count > 0 || remove.isPending}
                          >
                            {t("boards.deletePermanently")}
                          </Button>
                        </Group>
                      </Group>
                      {column.task_count > 0 ? (
                        <Text size="xs" c="dimmed" mt="xs">
                          {t("statuses.moveTasksFirst")}
                        </Text>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <Text size="sm" c="dimmed">
                  {t("statuses.noArchived")}
                </Text>
              )}
            </Tabs.Panel>
          </Tabs>
        </Stack>
      </Modal>

      <Modal
        opened={pendingArchive !== null}
        onClose={() => setPendingArchive(null)}
        title={pendingArchive ? t("statuses.removeTitle", { name: pendingArchive.name }) : t("statuses.removeStatus")}
        radius="lg"
      >
        {pendingArchive ? (
          <Stack>
            <Text size="sm">
              {tRich("statuses.removeExplainer", {
                archive: <strong>{t("boards.archive")}</strong>,
                delete: <strong>{t("common.delete")}</strong>,
              })}
            </Text>
            {pendingArchive.task_count > 0 ? (
              <>
                <Text size="sm">
                  {t("statuses.tasksWillMove", {
                    count: pendingArchive.task_count,
                    target: archiveTargetName ? t("statuses.targetSuffix", { name: archiveTargetName }) : "",
                  })}
                </Text>
                <Select
                  label={t("statuses.moveTasksTo")}
                  data={active
                    .filter((item) => item.id !== pendingArchive.id)
                    .map((item) => ({ value: item.id, label: item.name }))}
                  value={archiveMoveTo}
                  onChange={setArchiveMoveTo}
                  placeholder={t("statuses.targetStatus")}
                />
              </>
            ) : (
              <Text size="sm" c="dimmed">
                {t("statuses.noTasks")}
              </Text>
            )}
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setPendingArchive(null)}>
                {t("common.cancel")}
              </Button>
              <Button
                variant="light"
                onClick={() => void confirmArchive()}
                loading={archive.isPending}
                disabled={pendingArchive.task_count > 0 && !archiveMoveTo}
              >
                {t("boards.archive")}
              </Button>
              <Button
                color="red"
                onClick={() => void deleteNow()}
                loading={removeMovingTasks.isPending}
                disabled={pendingArchive.task_count > 0 && !archiveMoveTo}
              >
                {t("common.delete")}
              </Button>
            </Group>
          </Stack>
        ) : null}
      </Modal>

      <Modal
        opened={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title={t("statuses.deleteTitle")}
        radius="lg"
      >
        {pendingDelete ? (
          <Stack>
            <Text>
              {tRich("statuses.deleteConfirm", { name: <strong>{pendingDelete.name}</strong> })}
            </Text>
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setPendingDelete(null)}>
                {t("common.cancel")}
              </Button>
              <Button
                color="red"
                onClick={() => void confirmDelete()}
                loading={remove.isPending}
              >
                {t("boards.deletePermanently")}
              </Button>
            </Group>
          </Stack>
        ) : null}
      </Modal>
    </>
  );
}
