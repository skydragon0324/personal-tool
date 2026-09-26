from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import Board, BoardColumn, BoardMember, Note, ScheduleEntry, Task, TaskAssignee

# Boards are owned by `Board.user_id`; teammates get access through `board_members`.
# Members can work with tasks and categories. Statuses, board settings and membership are
# owner-only (pass `owner_only=True`).


def member_board_ids(user_id: uuid.UUID):
    """Subquery of boards shared with the user (not including boards they own)."""
    return select(BoardMember.board_id).where(BoardMember.user_id == user_id)


def board_access(user_id: uuid.UUID):
    """SQL condition on `Board`: the user owns the board or is a member of it."""
    return or_(Board.user_id == user_id, Board.id.in_(member_board_ids(user_id)))


def accessible_board_ids(user_id: uuid.UUID):
    """Subquery of every board id the user can access."""
    return select(Board.id).where(board_access(user_id))


def assigned_task_ids(user_id: uuid.UUID):
    """Subquery of tasks the user is one of the assignees of."""
    return select(TaskAssignee.task_id).where(TaskAssignee.user_id == user_id)


def task_notice_recipient(user_id: uuid.UUID):
    """Who is told about a task (reminders, overdue): its assignees, or the board owner when
    nobody is assigned. Needs `Board` and `Task` joined."""
    has_assignees = select(TaskAssignee.task_id).where(TaskAssignee.task_id == Task.id).exists()
    return or_(
        Task.id.in_(assigned_task_ids(user_id)),
        and_(~has_assignees, Board.user_id == user_id),
    )


def task_focus(user_id: uuid.UUID):
    """Tasks that belong in the user's Today, digest and reminders: everything on boards they own,
    plus tasks assigned to them on boards shared with them. Needs `Board` and `Task` joined."""
    return or_(
        Board.user_id == user_id,
        and_(Board.id.in_(member_board_ids(user_id)), Task.id.in_(assigned_task_ids(user_id))),
    )


def _require_owner(board_user_id: uuid.UUID, user_id: uuid.UUID) -> None:
    if board_user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the board owner can do this",
        )


def get_board_for_user(
    db: Session,
    user_id: uuid.UUID,
    board_id: uuid.UUID,
    *,
    owner_only: bool = False,
) -> Board:
    board = db.scalar(select(Board).where(Board.id == board_id, board_access(user_id)))
    if board is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Board not found")
    if owner_only:
        _require_owner(board.user_id, user_id)
    return board


def get_column_for_user(
    db: Session,
    user_id: uuid.UUID,
    column_id: uuid.UUID,
    *,
    owner_only: bool = False,
) -> BoardColumn:
    row = db.execute(
        select(BoardColumn, Board.user_id)
        .join(Board, Board.id == BoardColumn.board_id)
        .where(BoardColumn.id == column_id, board_access(user_id))
    ).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Column not found")
    column, owner_id = row
    if owner_only:
        _require_owner(owner_id, user_id)
    return column


def owned_task_query(user_id: uuid.UUID):
    """Tasks on boards the user can access (owned or shared)."""
    return (
        select(Task)
        .join(BoardColumn, BoardColumn.id == Task.column_id)
        .join(Board, Board.id == BoardColumn.board_id)
        .where(board_access(user_id))
    )


def get_task_for_user(
    db: Session,
    user_id: uuid.UUID,
    task_id: uuid.UUID,
    *,
    with_details: bool = False,
    for_update: bool = False,
) -> Task:
    query = owned_task_query(user_id).where(Task.id == task_id)
    if with_details:
        query = query.options(
            selectinload(Task.links),
            selectinload(Task.attachments),
            selectinload(Task.category),
            selectinload(Task.subtasks),
            selectinload(Task.recurrence_series),
        )
    if for_update:
        query = query.with_for_update()
    task = db.scalar(query)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


def get_note_for_user(db: Session, user_id: uuid.UUID, note_id: uuid.UUID) -> Note:
    note = db.scalar(select(Note).where(Note.id == note_id, Note.user_id == user_id))
    if note is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    return note


def get_schedule_entry_for_user(
    db: Session,
    user_id: uuid.UUID,
    entry_id: uuid.UUID,
) -> ScheduleEntry:
    entry = db.scalar(
        select(ScheduleEntry).where(ScheduleEntry.id == entry_id, ScheduleEntry.user_id == user_id)
    )
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule entry not found")
    return entry
