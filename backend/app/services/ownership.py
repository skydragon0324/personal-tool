from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import Board, BoardColumn, Note, ScheduleEntry, Task


def get_board_for_user(db: Session, user_id: uuid.UUID, board_id: uuid.UUID) -> Board:
    board = db.scalar(select(Board).where(Board.id == board_id, Board.user_id == user_id))
    if board is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Board not found")
    return board


def get_column_for_user(db: Session, user_id: uuid.UUID, column_id: uuid.UUID) -> BoardColumn:
    column = db.scalar(
        select(BoardColumn)
        .join(Board, Board.id == BoardColumn.board_id)
        .where(BoardColumn.id == column_id, Board.user_id == user_id)
    )
    if column is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Column not found")
    return column


def owned_task_query(user_id: uuid.UUID):
    return (
        select(Task)
        .join(BoardColumn, BoardColumn.id == Task.column_id)
        .join(Board, Board.id == BoardColumn.board_id)
        .where(Board.user_id == user_id)
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
