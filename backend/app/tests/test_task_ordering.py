from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.constants import BOOTSTRAP_USER_ID, COLUMN_TODO_ID
from app.models import Task
from app.schemas.task import TaskMove
from app.services import task_ordering_service


def test_same_column_reorder_down(db: Session, seed_tasks: list[Task], today: date) -> None:
    moving = seed_tasks[0]
    result = task_ordering_service.move_task(
        db,
        BOOTSTRAP_USER_ID,
        moving.id,
        TaskMove(target_column_id=COLUMN_TODO_ID, target_position=2, expected_version=1),
    )
    assert result.position == 2
    assert result.version == 2

    ordered = list(
        db.scalars(
            select(Task)
            .where(Task.column_id == COLUMN_TODO_ID, Task.due_date == today)
            .order_by(Task.position)
        ).all()
    )
    assert [t.title for t in ordered] == ["Bravo", "Charlie", "Alpha"]
    assert [t.position for t in ordered] == [0, 1, 2]


def test_same_column_reorder_up(db: Session, seed_tasks: list[Task], today: date) -> None:
    moving = seed_tasks[2]
    result = task_ordering_service.move_task(
        db,
        BOOTSTRAP_USER_ID,
        moving.id,
        TaskMove(target_column_id=COLUMN_TODO_ID, target_position=0, expected_version=1),
    )
    assert result.position == 0

    ordered = list(
        db.scalars(
            select(Task)
            .where(Task.column_id == COLUMN_TODO_ID, Task.due_date == today)
            .order_by(Task.position)
        ).all()
    )
    assert [t.title for t in ordered] == ["Charlie", "Alpha", "Bravo"]
