from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import Board, BoardColumn, Note, ScheduleEntry, ScheduleOccurrenceState, Task
from app.schemas.today import (
    ProgressRead,
    TodayPinnedNoteRead,
    TodayRead,
    TodayScheduleRead,
    TodayTaskRead,
)
from app.services.schedule_occurrence_service import entry_occurs_on, prune_old_occurrence_states

PINNED_NOTES_LIMIT = 6
PRIORITY_RANK = {"high": 0, "medium": 1, "low": 2}


def _progress(total: int, completed: int) -> ProgressRead:
    remaining = max(total - completed, 0)
    percentage = 0.0 if total <= 0 else round((completed / total) * 100, 1)
    return ProgressRead(total=total, completed=completed, remaining=remaining, percentage=percentage)


def _deadline_status(task: Task, column: BoardColumn, selected: date) -> str:
    if column.is_done or task.completed_at is not None:
        return "completed"
    if task.due_date < selected:
        return "overdue"
    if task.due_date == selected:
        return "due_today"
    if task.start_date == selected:
        return "starts_today"
    return "in_progress"


def _note_preview(body: str, lines: int = 2) -> str:
    parts = (body or "").splitlines()
    return "\n".join(parts[:lines]).strip()


def _serialize_task(task: Task, board: Board, column: BoardColumn, selected: date) -> TodayTaskRead:
    subtasks = list(task.subtasks or [])
    return TodayTaskRead(
        id=task.id,
        title=task.title,
        start_date=task.start_date,
        due_date=task.due_date,
        priority=task.priority,
        completed_at=task.completed_at,
        board_id=board.id,
        board_name=board.name,
        board_color=board.color,
        board_icon_name=board.icon_name,
        status_id=column.id,
        status_name=column.name,
        status_color=column.color,
        status_is_done=column.is_done,
        subtask_completed=sum(1 for item in subtasks if item.is_completed),
        subtask_total=len(subtasks),
        deadline_status=_deadline_status(task, column, selected),
    )


def _load_task_rows(db: Session, user_id: uuid.UUID, *extra_filters):
    return list(
        db.execute(
            select(Task, Board, BoardColumn)
            .join(BoardColumn, BoardColumn.id == Task.column_id)
            .join(Board, Board.id == BoardColumn.board_id)
            .options(selectinload(Task.subtasks))
            .where(
                Board.user_id == user_id,
                Board.archived_at.is_(None),
                BoardColumn.archived_at.is_(None),
                *extra_filters,
            )
        ).all()
    )


def _sort_active(tasks: list[TodayTaskRead]) -> list[TodayTaskRead]:
    return sorted(
        tasks,
        key=lambda item: (
            1 if item.status_is_done or item.completed_at is not None else 0,
            PRIORITY_RANK.get(item.priority, 9),
            item.due_date,
            item.title.lower(),
        ),
    )


def _sort_overdue(tasks: list[TodayTaskRead]) -> list[TodayTaskRead]:
    return sorted(
        tasks,
        key=lambda item: (
            PRIORITY_RANK.get(item.priority, 9),
            item.due_date,
            item.title.lower(),
        ),
    )


def get_today(db: Session, user_id: uuid.UUID, selected: date) -> TodayRead:
    prune_old_occurrence_states(db, user_id, selected)
    db.commit()

    active_rows = _load_task_rows(
        db,
        user_id,
        Task.start_date <= selected,
        Task.due_date >= selected,
    )
    overdue_rows = _load_task_rows(
        db,
        user_id,
        Task.due_date < selected,
        Task.completed_at.is_(None),
        BoardColumn.is_done.is_(False),
    )

    active_tasks = _sort_active(
        [_serialize_task(task, board, column, selected) for task, board, column in active_rows]
    )
    overdue_tasks = _sort_overdue(
        [_serialize_task(task, board, column, selected) for task, board, column in overdue_rows]
    )
    task_completed = sum(
        1 for item in active_tasks if item.status_is_done or item.completed_at is not None
    )

    entries = list(
        db.scalars(
            select(ScheduleEntry)
            .where(ScheduleEntry.user_id == user_id)
            .order_by(ScheduleEntry.start_time, ScheduleEntry.title)
        ).all()
    )
    occurring = [entry for entry in entries if entry_occurs_on(entry, selected)]
    states = {
        row.schedule_entry_id: row
        for row in db.scalars(
            select(ScheduleOccurrenceState).where(
                ScheduleOccurrenceState.user_id == user_id,
                ScheduleOccurrenceState.occurrence_date == selected,
            )
        ).all()
    }

    today_schedules: list[TodayScheduleRead] = []
    for entry in occurring:
        state = states.get(entry.id)
        today_schedules.append(
            TodayScheduleRead(
                id=entry.id,
                title=entry.title,
                kind=entry.kind,
                weekdays=list(entry.weekdays or []),
                week_start=entry.week_start,
                start_time=entry.start_time,
                end_time=entry.end_time,
                priority=entry.priority,
                color=entry.color,
                notes=entry.notes,
                is_completed=bool(state.is_completed) if state else False,
                completed_at=state.completed_at if state else None,
            )
        )
    today_schedules.sort(key=lambda item: (item.start_time, item.title.lower()))
    schedule_completed = sum(1 for item in today_schedules if item.is_completed)

    pinned_stmt = (
        select(Note)
        .where(Note.user_id == user_id, Note.is_pinned.is_(True))
        .order_by(Note.updated_at.desc(), Note.created_at.desc())
    )
    pinned_all = list(db.scalars(pinned_stmt).all())
    pinned_notes = [
        TodayPinnedNoteRead(
            id=note.id,
            title=note.title,
            preview=_note_preview(note.body),
            priority=note.priority,
            updated_at=note.updated_at,
        )
        for note in pinned_all[:PINNED_NOTES_LIMIT]
    ]

    return TodayRead(
        date=selected,
        task_progress=_progress(len(active_tasks), task_completed),
        schedule_progress=_progress(len(today_schedules), schedule_completed),
        active_tasks=active_tasks,
        overdue_tasks=overdue_tasks,
        schedules=today_schedules,
        pinned_notes=pinned_notes,
        pinned_notes_total=len(pinned_all),
    )
