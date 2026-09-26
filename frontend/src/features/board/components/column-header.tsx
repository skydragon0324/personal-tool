"use client";

import { ActionIcon, Button, Group, Menu, Modal, Select, Text, TextInput } from "@mantine/core";
import { useState } from "react";

import { notifyApiError, notifySuccess } from "@/lib/notify";

import { useColumnMutations } from "../hooks/use-columns";
import type { BoardColumn } from "../types";
import { STATUS_COLORS, statusHeaderClass } from "../utils/status-colors";

interface ColumnHeaderProps {
  boardId: string;
  column: BoardColumn;
  /** All active statuses in board order. */
  columns: BoardColumn[];
  taskCount: number;
  canManage: boolean;
  onAdd: (columnId: string) => void;
}

/**
 * Status column header. Owners can rename it in place (double-click the name), recolor it,
 * mark it as a completed status, move it left/right and delete it right from the board.
 */
export function ColumnHeader({ boardId, column, columns, taskCount, canManage, onAdd }: ColumnHeaderProps) {
  const { update, reorder, removeMovingTasks } = useColumnMutations(boardId);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(column.name);
  const [deleting, setDeleting] = useState(false);
  const others = columns.filter((item) => item.id !== column.id);
  const [moveTo, setMoveTo] = useState<string | null>(others[0]?.id ?? null);
  const index = columns.findIndex((item) => item.id === column.id);

  function save(payload: { name?: string; color?: string; is_done?: boolean }) {
    update.mutate(
      { columnId: column.id, payload },
      { onError: (error) => notifyApiError(error, "Could not update the status") },
    );
  }

  function commitName() {
    const next = name.trim();
    setEditing(false);
    if (next && next !== column.name) save({ name: next });
    else setName(column.name);
  }

  function move(offset: -1 | 1) {
    reorder.mutate(
      { columnId: column.id, targetPosition: index + offset },
      { onError: (error) => notifyApiError(error, "Could not move the status") },
    );
  }

  async function confirmDelete() {
    try {
      await removeMovingTasks.mutateAsync({ columnId: column.id, moveToColumnId: moveTo });
      notifySuccess(`Deleted ${column.name}`);
      setDeleting(false);
    } catch (error) {
      notifyApiError(error, "Could not delete the status");
    }
  }

  return (
    <header
      className={`sticky top-0 z-10 flex items-center justify-between gap-2 px-3 py-2.5 text-white ${statusHeaderClass(column.color)}`}
    >
      <div className="min-w-0 flex-1">
        {editing ? (
          <TextInput
            size="xs"
            value={name}
            autoFocus
            maxLength={50}
            aria-label="Status name"
            onChange={(event) => setName(event.currentTarget.value)}
            onBlur={commitName}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitName();
              if (event.key === "Escape") {
                setName(column.name);
                setEditing(false);
              }
            }}
          />
        ) : (
          <h2
            className={`truncate font-display text-lg leading-tight ${canManage ? "cursor-text" : ""}`}
            title={canManage ? "Double-click to rename" : undefined}
            onDoubleClick={() => {
              if (!canManage) return;
              setName(column.name);
              setEditing(true);
            }}
          >
            {column.name}
          </h2>
        )}
        <p className="text-xs text-white/80">
          {taskCount}
          {column.is_done ? " · counts as completed" : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => onAdd(column.id)}
          className="rounded-lg bg-white/15 px-2.5 py-1 text-sm font-medium hover:bg-white/25"
        >
          Add
        </button>
        {canManage ? (
          <Menu shadow="md" position="bottom-end" width={220} withinPortal>
            <Menu.Target>
              <ActionIcon
                variant="subtle"
                color="white"
                aria-label={`Status menu for ${column.name}`}
                className="hover:!bg-white/20"
              >
                ⋯
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                onClick={() => {
                  setName(column.name);
                  setEditing(true);
                }}
              >
                Rename
              </Menu.Item>
              <Menu.Label>Color</Menu.Label>
              <div className="grid grid-cols-7 gap-1.5 px-3 pb-2">
                {STATUS_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Color ${color}`}
                    aria-pressed={column.color === color}
                    onClick={() => save({ color })}
                    className={`h-5 w-5 rounded-full ${statusHeaderClass(color)} ${
                      column.color === color ? "ring-2 ring-[var(--app-primary)] ring-offset-1" : ""
                    }`}
                  />
                ))}
              </div>
              <Menu.Item
                onClick={() => save({ is_done: !column.is_done })}
                rightSection={column.is_done ? "✓" : null}
              >
                Counts as completed
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item disabled={index <= 0} onClick={() => move(-1)}>
                Move left
              </Menu.Item>
              <Menu.Item disabled={index < 0 || index >= columns.length - 1} onClick={() => move(1)}>
                Move right
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                color="red"
                disabled={others.length === 0}
                onClick={() => {
                  setMoveTo(others[0]?.id ?? null);
                  setDeleting(true);
                }}
              >
                Delete status
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        ) : null}
      </div>

      <Modal opened={deleting} onClose={() => setDeleting(false)} title={`Delete “${column.name}”?`} radius="lg">
        <Text size="sm" c="dimmed">
          The status is removed from the board. Its tasks are kept and moved to the status you pick.
        </Text>
        <Select
          mt="md"
          label="Move its tasks to"
          data={others.map((item) => ({ value: item.id, label: item.name }))}
          value={moveTo}
          onChange={setMoveTo}
          allowDeselect={false}
        />
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={() => setDeleting(false)}>
            Cancel
          </Button>
          <Button color="red" onClick={() => void confirmDelete()} loading={removeMovingTasks.isPending} disabled={!moveTo}>
            Delete status
          </Button>
        </Group>
      </Modal>
    </header>
  );
}

/** "+ Add status" placeholder column at the end of the board (owners only). */
export function AddStatusColumn({ boardId, columns }: { boardId: string; columns: BoardColumn[] }) {
  const { create } = useColumnMutations(boardId);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const used = new Set(columns.map((column) => column.color));
    const color = STATUS_COLORS.find((item) => !used.has(item)) ?? "slate";
    try {
      await create.mutateAsync({ name: trimmed, color });
      setName("");
      setOpen(false);
    } catch (error) {
      notifyApiError(error, "Could not add the status");
    }
  }

  return (
    <div className="flex-none" style={{ width: "16rem" }}>
      {open ? (
        <form
          className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <TextInput
            size="sm"
            placeholder="Status name, e.g. Review"
            aria-label="New status name"
            value={name}
            autoFocus
            maxLength={50}
            onChange={(event) => setName(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setOpen(false);
            }}
          />
          <Group gap="xs" mt="xs">
            <Button type="submit" size="xs" loading={create.isPending} disabled={!name.trim()}>
              Add status
            </Button>
            <Button size="xs" variant="subtle" color="gray" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </Group>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-12 w-full items-center justify-center rounded-2xl border-2 border-dashed border-[var(--app-border)] text-sm font-medium text-[var(--app-text-muted)] hover:border-[var(--app-primary)] hover:text-[var(--app-primary)]"
        >
          + Add status
        </button>
      )}
    </div>
  );
}
