import { move } from "@dnd-kit/helpers";
import { CollisionPriority } from "@dnd-kit/abstract";
import { DragDropProvider } from "@dnd-kit/react";
import { useDroppable } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { Button, Group, Modal, Stack, Tabs, Text, TextInput } from "@mantine/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "@/lib/navigation";

import { formatDateTime } from "@/lib/dates";
import { notifyApiError, notifySuccess } from "@/lib/notify";
import { useBoardMutations, useBoards } from "../hooks/use-boards";
import type { BoardListItem } from "../types";
import { BOARD_COLORS, BOARD_ICONS, BoardGlyph, boardColorClass, boardIconLabel } from "../utils/board-icons";
import { resolveLastBoardId } from "../utils/last-board";
import { colorName, t } from "@/i18n";
import { tRich } from "@/i18n/rich";

interface ManageBoardsModalProps {
  opened: boolean;
  onClose: () => void;
  currentBoardId?: string;
}

function SortableBoardRow({
  board,
  index,
  onRename,
  onColor,
  onIcon,
  onArchive,
  archiveDisabled,
}: {
  board: BoardListItem;
  index: number;
  onRename: (name: string) => void;
  onColor: (color: string) => void;
  onIcon: (icon: string) => void;
  onArchive: () => void;
  archiveDisabled: boolean;
}) {
  const { ref, handleRef } = useSortable({
    id: board.id,
    index,
    type: "board",
    accept: "board",
    group: "boards",
  });
  const [name, setName] = useState(board.name);

  useEffect(() => {
    setName(board.name);
  }, [board.name]);

  return (
    <div ref={ref} className="rounded-xl border border-[var(--app-border)] p-3">
      <div className="flex flex-wrap items-start gap-3">
        <button
          type="button"
          ref={handleRef}
          className="mt-1 cursor-grab rounded-md border border-[var(--app-border)] px-2 py-1 text-[var(--app-text-muted)]"
          aria-label={t("boards.reorder", { name: board.name })}
        >
          ⋮⋮
        </button>
        <span className={`mt-1 flex h-8 w-8 items-center justify-center rounded-md text-white ${boardColorClass(board.color)}`}>
          <BoardGlyph name={board.icon_name} />
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <TextInput
            label={t("boards.name")}
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            onBlur={() => {
              if (name.trim() && name.trim() !== board.name) onRename(name.trim());
            }}
          />
          <Group gap="xs">
            {BOARD_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={`h-5 w-5 rounded-full ${boardColorClass(color)} ${
                  board.color === color ? "ring-2 ring-[var(--app-primary)] ring-offset-2" : ""
                }`}
                onClick={() => onColor(color)}
                aria-label={colorName(color)}
              />
            ))}
          </Group>
          <Group gap="xs">
            {BOARD_ICONS.map((icon) => (
              <button
                key={icon}
                type="button"
                className={`flex h-8 w-8 items-center justify-center rounded-md border ${
                  board.icon_name === icon
                    ? "border-[var(--app-primary)]"
                    : "border-[var(--app-border)]"
                }`}
                onClick={() => onIcon(icon)}
                aria-label={boardIconLabel(icon)}
              >
                <BoardGlyph name={icon} size={14} />
              </button>
            ))}
          </Group>
          <Button size="xs" color="red" variant="light" onClick={onArchive} disabled={archiveDisabled}>
            {t("boards.archive")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function BoardList({ children }: { children: React.ReactNode }) {
  const { ref } = useDroppable({
    id: "boards",
    type: "column",
    accept: "board",
    collisionPriority: CollisionPriority.Low,
  });
  return (
    <div ref={ref} className="space-y-3">
      {children}
    </div>
  );
}

export function ManageBoardsModal({ opened, onClose, currentBoardId }: ManageBoardsModalProps) {
  const router = useRouter();
  const boardsQuery = useBoards(true);
  const { update, reorder, archive, restore, remove } = useBoardMutations(currentBoardId);
  const [pendingArchive, setPendingArchive] = useState<BoardListItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<BoardListItem | null>(null);
  const [deleteName, setDeleteName] = useState("");

  const active = useMemo(
    () =>
      (boardsQuery.data ?? [])
        // Boards shared with you are managed by their owner.
        .filter((board) => !board.archived_at && board.role !== "member")
        .sort((a, b) => a.position - b.position),
    [boardsQuery.data],
  );
  const archived = useMemo(
    () => (boardsQuery.data ?? []).filter((board) => board.archived_at),
    [boardsQuery.data],
  );
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const orderedRef = useRef(orderedIds);

  useEffect(() => {
    const ids = active.map((board) => board.id);
    setOrderedIds(ids);
    orderedRef.current = ids;
  }, [active]);

  const orderedBoards = orderedIds
    .map((id) => active.find((board) => board.id === id))
    .filter((board): board is BoardListItem => Boolean(board));

  async function confirmArchive() {
    if (!pendingArchive) return;
    try {
      await archive.mutateAsync(pendingArchive.id);
      notifySuccess(t("boards.archived", { name: pendingArchive.name }));
      if (pendingArchive.id === currentBoardId) {
        const nextId = resolveLastBoardId(
          (boardsQuery.data ?? []).map((board) =>
            board.id === pendingArchive.id ? { ...board, archived_at: new Date().toISOString() } : board,
          ),
          null,
        );
        if (nextId) router.push(`/boards/${nextId}`);
        else router.push("/");
      }
      setPendingArchive(null);
    } catch (error) {
      notifyApiError(error, t("boards.couldNotArchive"));
    }
  }

  async function confirmDelete() {
    if (!pendingDelete || deleteName !== pendingDelete.name) return;
    try {
      await remove.mutateAsync(pendingDelete.id);
      notifySuccess(t("boards.deleted", { name: pendingDelete.name }));
      setPendingDelete(null);
      setDeleteName("");
    } catch (error) {
      notifyApiError(error, t("boards.couldNotDelete"));
    }
  }

  return (
    <>
      <Modal
        opened={opened}
        onClose={onClose}
        title={t("boards.manageTitle")}
        size="xl"
        radius="lg"
        styles={{ body: { maxHeight: "min(75vh, 720px)", overflowY: "auto" } }}
      >
        <Tabs defaultValue="active">
          <Tabs.List>
            <Tabs.Tab value="active">{t("boards.activeTab", { count: active.length })}</Tabs.Tab>
            <Tabs.Tab value="archived">{t("boards.archivedTab", { count: archived.length })}</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="active" pt="md">
            <DragDropProvider
              onDragOver={(event) => {
                if (event.operation.source?.type === "column") return;
                setOrderedIds((current) => {
                  const next = move({ boards: current }, event) as { boards: string[] };
                  orderedRef.current = next.boards;
                  return next.boards;
                });
              }}
              onDragEnd={async (event) => {
                const sourceId = String(event.operation.source?.id ?? "");
                if (!sourceId || event.canceled) return;
                const target = orderedRef.current.indexOf(sourceId);
                const original = active.findIndex((board) => board.id === sourceId);
                if (target < 0 || original < 0 || target === original) return;
                try {
                  await reorder.mutateAsync({ boardId: sourceId, targetPosition: target });
                } catch (error) {
                  notifyApiError(error, t("boards.couldNotReorder"));
                  setOrderedIds(active.map((board) => board.id));
                }
              }}
            >
              <BoardList>
                {orderedBoards.map((board, index) => (
                  <SortableBoardRow
                    key={board.id}
                    board={board}
                    index={index}
                    onRename={(name) =>
                      void update.mutateAsync({ boardId: board.id, payload: { name } }).catch((error) => {
                        notifyApiError(error, t("boards.couldNotRename"));
                      })
                    }
                    onColor={(color) =>
                      void update.mutateAsync({ boardId: board.id, payload: { color } }).catch((error) => {
                        notifyApiError(error, t("boards.couldNotChangeColor"));
                      })
                    }
                    onIcon={(icon_name) =>
                      void update.mutateAsync({ boardId: board.id, payload: { icon_name } }).catch((error) => {
                        notifyApiError(error, t("boards.couldNotChangeIcon"));
                      })
                    }
                    onArchive={() => setPendingArchive(board)}
                    archiveDisabled={active.length <= 1}
                  />
                ))}
              </BoardList>
            </DragDropProvider>
          </Tabs.Panel>
          <Tabs.Panel value="archived" pt="md">
            <Text size="sm" c="dimmed" mb="md">
              {t("boards.archiveHint")}
            </Text>
            {archived.length ? (
              <div className="space-y-3">
                {archived.map((board) => (
                  <div key={board.id} className="rounded-xl border border-[var(--app-border)] p-4">
                    <Group justify="space-between" align="flex-start">
                      <div>
                        <Text fw={600}>{board.name}</Text>
                        <Text size="sm" c="dimmed">
                          {t("boards.archivedAt", { date: board.archived_at ? formatDateTime(board.archived_at) : "" })}
                        </Text>
                        <Text size="sm" c="dimmed">
                          {t("boards.taskCount", { count: board.total_tasks })} ·{" "}
                          {t("boards.statusCount", { count: board.status_count })} ·{" "}
                          {t("boards.attachmentCount", { count: board.attachment_count })}
                        </Text>
                      </div>
                      <Group gap="xs">
                        <Button
                          variant="light"
                          onClick={() =>
                            void restore.mutateAsync(board.id).then(
                              () => notifySuccess(t("boards.restored", { name: board.name })),
                              (error) => notifyApiError(error, t("boards.couldNotRestore")),
                            )
                          }
                          loading={restore.isPending && restore.variables === board.id}
                          disabled={restore.isPending || remove.isPending}
                        >
                          {t("boards.restore")}
                        </Button>
                        <Button
                          color="red"
                          variant="light"
                          onClick={() => {
                            setPendingDelete(board);
                            setDeleteName("");
                          }}
                          disabled={remove.isPending}
                        >
                          {t("boards.deletePermanently")}
                        </Button>
                      </Group>
                    </Group>
                  </div>
                ))}
              </div>
            ) : (
              <Text size="sm" c="dimmed">
                {t("boards.noArchived")}
              </Text>
            )}
          </Tabs.Panel>
        </Tabs>
      </Modal>

      <Modal opened={pendingArchive !== null} onClose={() => setPendingArchive(null)} title={t("boards.archiveTitle")} radius="lg">
        {pendingArchive ? (
          <Stack>
            <Text>
              {tRich("boards.archiveConfirm", { name: <strong>{pendingArchive.name}</strong> })}
            </Text>
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setPendingArchive(null)}>
                {t("common.cancel")}
              </Button>
              <Button color="red" onClick={() => void confirmArchive()} loading={archive.isPending}>
                {t("boards.archive")}
              </Button>
            </Group>
          </Stack>
        ) : null}
      </Modal>

      <Modal
        opened={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title={t("boards.deleteTitle")}
        radius="lg"
      >
        {pendingDelete ? (
          <Stack>
            <Text>
              {tRich("boards.deleteConfirm", { name: <strong>{pendingDelete.name}</strong> })}
            </Text>
            <Text size="sm">
              {t("boards.deleteCounts", {
                tasks: t("boards.taskCount", { count: pendingDelete.total_tasks }),
                attachments: t("boards.attachmentCount", { count: pendingDelete.attachment_count }),
                statuses: t("boards.statusCount", { count: pendingDelete.status_count }),
              })}
            </Text>
            <Text size="sm" c="red">
              {t("boards.cannotUndo")}
            </Text>
            <TextInput
              label={t("boards.typeNameToConfirm")}
              value={deleteName}
              onChange={(event) => setDeleteName(event.currentTarget.value)}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setPendingDelete(null)}>
                {t("common.cancel")}
              </Button>
              <Button
                color="red"
                onClick={() => void confirmDelete()}
                loading={remove.isPending}
                disabled={deleteName !== pendingDelete.name}
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
