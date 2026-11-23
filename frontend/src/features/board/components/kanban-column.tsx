import { CollisionPriority } from "@dnd-kit/abstract";
import { useDroppable } from "@dnd-kit/react";

import type { BoardColumn, BoardPerson, TaskSummary } from "../types";
import { statusSoftClass } from "../utils/status-colors";
import { ColumnHeader } from "./column-header";
import { EmptyColumn } from "./empty-column";
import { TaskCard } from "./task-card";

interface KanbanColumnProps {
  boardId: string;
  canManageStatuses: boolean;
  people: BoardPerson[];
  onAssign: (task: TaskSummary, userIds: string[]) => void;
  onDuplicate: (task: TaskSummary) => void;
  onMoveToBoard: (task: TaskSummary) => void;
  column: BoardColumn;
  columns: BoardColumn[];
  tasks: TaskSummary[];
  onAdd: (columnId: string) => void;
  onOpenDetail: (task: TaskSummary, mode?: "view" | "edit") => void;
  onDelete: (task: TaskSummary) => void;
  onMoveStatus: (task: TaskSummary, columnId: string) => void;
}

export function KanbanColumn({
  boardId,
  canManageStatuses,
  people,
  onAssign,
  onDuplicate,
  onMoveToBoard,
  column,
  columns,
  tasks,
  onAdd,
  onOpenDetail,
  onDelete,
  onMoveStatus,
}: KanbanColumnProps) {
  const { ref, isDropTarget } = useDroppable({
    id: column.id,
    type: "column",
    accept: "item",
    collisionPriority: tasks.length === 0 ? CollisionPriority.High : CollisionPriority.Low,
  });

  return (
    <section
      className="flex flex-col overflow-hidden rounded-[1.25rem] border border-[var(--app-border)] bg-[var(--app-surface)] shadow-[0_8px_24px_rgba(31,55,50,0.045)]"
      style={{ flex: "1 0 19rem", minWidth: "19rem", maxWidth: "27rem" }}
    >
      <ColumnHeader
        boardId={boardId}
        column={column}
        columns={columns}
        taskCount={tasks.length}
        canManage={canManageStatuses}
        onAdd={onAdd}
      />
      <div
        ref={ref}
        data-column-id={column.id}
        className={`flex min-h-[12rem] flex-1 flex-col gap-2.5 overflow-y-auto p-2.5 ${statusSoftClass(column.color)} ${
          isDropTarget ? "bg-[var(--app-primary)]/10" : ""
        }`}
      >
        {tasks.length === 0 ? (
          <EmptyColumn />
        ) : (
          tasks.map((task, index) => (
            <TaskCard
              key={task.id}
              task={task}
              index={index}
              columnId={column.id}
              columns={columns}
              onOpenDetail={onOpenDetail}
              onDelete={onDelete}
              onMoveStatus={onMoveStatus}
              people={people}
              onAssign={onAssign}
              onDuplicate={onDuplicate}
              onMoveToBoard={onMoveToBoard}
            />
          ))
        )}
      </div>
    </section>
  );
}
