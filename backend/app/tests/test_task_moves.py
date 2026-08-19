from __future__ import annotations

from datetime import date

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.constants import COLUMN_DONE_ID, COLUMN_IN_PROGRESS_ID, COLUMN_TODO_ID
from app.models import Task
from app.schemas.task import TaskMove
from app.services import task_ordering_service


def test_cross_column_move(db: Session, seed_tasks: list[Task], today: date) -> None:
    moving = seed_tasks[1]
    result = task_ordering_service.move_task(
        db,
        moving.id,
        TaskMove(
            target_column_id=COLUMN_IN_PROGRESS_ID,
            target_position=0,
            expected_version=1,
        ),
    )
    assert result.column_id == COLUMN_IN_PROGRESS_ID
    assert result.position == 0
    assert result.completed_at is None
    assert result.version == 2

    todo = list(
        db.scalars(
            select(Task)
            .where(Task.column_id == COLUMN_TODO_ID, Task.due_date == today)
            .order_by(Task.position)
        ).all()
    )
    assert [t.title for t in todo] == ["Alpha", "Charlie"]
    assert [t.position for t in todo] == [0, 1]


def test_move_to_done_sets_completed_at(db: Session, seed_tasks: list[Task]) -> None:
    moving = seed_tasks[0]
    result = task_ordering_service.move_task(
        db,
        moving.id,
        TaskMove(target_column_id=COLUMN_DONE_ID, target_position=0, expected_version=1),
    )
    assert result.column_id == COLUMN_DONE_ID
    assert result.completed_at is not None


def test_move_from_done_clears_completed_at(db: Session, seed_tasks: list[Task]) -> None:
    moving = seed_tasks[0]
    task_ordering_service.move_task(
        db,
        moving.id,
        TaskMove(target_column_id=COLUMN_DONE_ID, target_position=0, expected_version=1),
    )
    db.refresh(moving)
    result = task_ordering_service.move_task(
        db,
        moving.id,
        TaskMove(
            target_column_id=COLUMN_TODO_ID,
            target_position=0,
            expected_version=moving.version,
        ),
    )
    assert result.column_id == COLUMN_TODO_ID
    assert result.completed_at is None


def test_stale_version_returns_409(db: Session, seed_tasks: list[Task]) -> None:
    moving = seed_tasks[0]
    try:
        task_ordering_service.move_task(
            db,
            moving.id,
            TaskMove(
                target_column_id=COLUMN_IN_PROGRESS_ID,
                target_position=0,
                expected_version=999,
            ),
        )
        raised = False
    except HTTPException as exc:
        raised = True
        assert exc.status_code == 409
    assert raised
