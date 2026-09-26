"use client";

import { Alert, Button, Group, Modal, Select, Stack, Text } from "@mantine/core";
import { useEffect, useMemo, useState } from "react";

import { useBoardMembers } from "../hooks/use-board-members";
import { activeBoards, useBoards } from "../hooks/use-boards";
import { activeColumns, useColumns } from "../hooks/use-columns";
import type { TaskAssignee } from "../types";

export interface MovableTask {
  id: string;
  title: string;
  assignees?: TaskAssignee[];
  repeating?: boolean;
}

export function MoveToBoardModal({
  task,
  currentBoardId,
  submitting,
  onClose,
  onMove,
}: {
  task: MovableTask | null;
  currentBoardId: string;
  submitting?: boolean;
  onClose: () => void;
  onMove: (boardId: string, columnId: string | null) => void;
}) {
  const boardsQuery = useBoards(false);
  const boards = useMemo(
    () => activeBoards(boardsQuery.data).filter((board) => board.id !== currentBoardId),
    [boardsQuery.data, currentBoardId],
  );
  const [boardId, setBoardId] = useState<string | null>(null);
  const [columnId, setColumnId] = useState<string | null>(null);
  const columnsQuery = useColumns(boardId ?? "", false);
  const columns = useMemo(() => activeColumns(columnsQuery.data), [columnsQuery.data]);
  const assignees = task?.assignees ?? [];
  const membersQuery = useBoardMembers(boardId ?? "", Boolean(boardId && assignees.length));

  useEffect(() => {
    if (!task) return;
    setBoardId(null);
    setColumnId(null);
  }, [task]);

  useEffect(() => {
    // Default to the first open status of the chosen board.
    if (!columns.length) return;
    setColumnId((current) =>
      current && columns.some((column) => column.id === current)
        ? current
        : (columns.find((column) => !column.is_done) ?? columns[0]).id,
    );
  }, [columns]);

  const onTarget = new Set(membersQuery.data?.people.map((person) => person.user_id) ?? []);
  const dropped = membersQuery.data ? assignees.filter((person) => !onTarget.has(person.id)) : [];
  const names = (list: TaskAssignee[]) => list.map((person) => person.display_name).join(", ");

  return (
    <Modal opened={task !== null} onClose={onClose} title="Move to another board" radius="lg">
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          “{task?.title}” moves with its content, sub-tasks, links and files.
        </Text>
        {boards.length === 0 && boardsQuery.isSuccess ? (
          <Alert color="gray">You don&apos;t have another board yet. Create one first.</Alert>
        ) : null}
        <Select
          label="Board"
          placeholder="Choose a board"
          data={boards.map((board) => ({
            value: board.id,
            label: board.role === "member" ? `${board.name} (shared)` : board.name,
          }))}
          value={boardId}
          onChange={(value) => {
            setBoardId(value);
            setColumnId(null);
          }}
          searchable
          data-autofocus
        />
        <Select
          label="Status"
          placeholder={boardId ? "Choose a status" : "Choose a board first"}
          data={columns.map((column) => ({ value: column.id, label: column.name }))}
          value={columnId}
          onChange={setColumnId}
          disabled={!boardId || columns.length === 0}
          allowDeselect={false}
        />
        {assignees.length > 0 && boardId && membersQuery.data ? (
          <Text size="sm" c={dropped.length ? "orange" : "dimmed"}>
            {dropped.length
              ? `${names(dropped)} ${dropped.length === 1 ? "is" : "are"} not on that board and will be unassigned.`
              : "Everyone assigned is on that board and stays assigned."}
          </Text>
        ) : null}
        {task?.repeating ? (
          <Text size="sm" c="dimmed">
            This occurrence leaves its repeating series and becomes a one-off task.
          </Text>
        ) : null}
        <Group justify="flex-end" mt="xs">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!boardId || !columnId}
            loading={submitting}
            onClick={() => boardId && onMove(boardId, columnId)}
          >
            Move task
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
