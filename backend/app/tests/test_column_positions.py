from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.constants import BOOTSTRAP_USER_ID, COLUMN_IN_PROGRESS_ID, COLUMN_TODO_ID
from app.models import Task
from app.schemas.task import TaskCreate, TaskMove, TaskUpdate
from app.services import task_ordering_service, task_service


def test_column_wide_positions_ignore_due_date(
    db: Session,
    seed_tasks: list[Task],
    today: date,
    uncategorized_id,
) -> None:
    later = Task(
        column_id=COLUMN_TODO_ID,
        category_id=uncategorized_id,
        title="Later",
        start_date=today + timedelta(days=3),
        due_date=today + timedelta(days=3),
        priority="low",
        position=3,
        version=1,
    )
    db.add(later)
    db.commit()

    moving = seed_tasks[0]
    result = task_ordering_service.move_task(
        db,
        BOOTSTRAP_USER_ID,
        moving.id,
        TaskMove(
            target_column_id=COLUMN_TODO_ID,
            after_task_id=later.id,
            expected_version=1,
        ),
    )
    assert result.position == 3

    ordered = list(
        db.scalars(
            select(Task).where(Task.column_id == COLUMN_TODO_ID).order_by(Task.position)
        ).all()
    )
    assert [task.title for task in ordered] == ["Bravo", "Charlie", "Later", "Alpha"]
    assert [task.position for task in ordered] == [0, 1, 2, 3]


def test_anchor_move_skips_hidden_neighbors(
    db: Session,
    seed_tasks: list[Task],
) -> None:
    """Visible tasks Alpha and Charlie; Bravo is treated as filtered/hidden."""
    alpha, bravo, charlie = seed_tasks
    result = task_ordering_service.move_task(
        db,
        BOOTSTRAP_USER_ID,
        charlie.id,
        TaskMove(
            target_column_id=COLUMN_TODO_ID,
            after_task_id=alpha.id,
            before_task_id=None,
            expected_version=1,
        ),
    )
    assert result.position == 1
    ordered = list(
        db.scalars(
            select(Task).where(Task.column_id == COLUMN_TODO_ID).order_by(Task.position)
        ).all()
    )
    assert [task.title for task in ordered] == ["Alpha", "Charlie", "Bravo"]


def test_cross_column_different_due_dates(
    db: Session,
    seed_tasks: list[Task],
    today: date,
    uncategorized_id,
) -> None:
    other = Task(
        column_id=COLUMN_IN_PROGRESS_ID,
        category_id=uncategorized_id,
        title="Progress later",
        start_date=today + timedelta(days=5),
        due_date=today + timedelta(days=5),
        priority="medium",
        position=0,
        version=1,
    )
    db.add(other)
    db.commit()

    moving = seed_tasks[0]
    result = task_ordering_service.move_task(
        db,
        BOOTSTRAP_USER_ID,
        moving.id,
        TaskMove(
            target_column_id=COLUMN_IN_PROGRESS_ID,
            after_task_id=other.id,
            expected_version=1,
        ),
    )
    assert result.column_id == COLUMN_IN_PROGRESS_ID
    assert result.position == 1
    assert result.due_date == today


def test_due_date_change_keeps_column_position(
    db: Session,
    seed_tasks: list[Task],
    today: date,
) -> None:
    moving = seed_tasks[1]
    updated = task_service.update_task(db, BOOTSTRAP_USER_ID, moving.id, TaskUpdate(due_date=today + timedelta(days=4)))
    assert updated.position == 1
    remaining = list(
        db.scalars(select(Task).where(Task.column_id == COLUMN_TODO_ID).order_by(Task.position)).all()
    )
    assert [task.position for task in remaining] == [0, 1, 2]


def test_create_appends_to_column_regardless_of_due_date(
    db: Session,
    seed_tasks: list[Task],
    today: date,
    uncategorized_id,
) -> None:
    created = task_service.create_task(
        db,
        BOOTSTRAP_USER_ID,
        TaskCreate(
            column_id=COLUMN_TODO_ID,
            category_id=uncategorized_id,
            title="Far due",
            due_date=today + timedelta(days=12),
        ),
    )
    assert created.position == 3
    positions = list(
        db.scalars(select(Task.position).where(Task.column_id == COLUMN_TODO_ID)).all()
    )
    assert sorted(positions) == [0, 1, 2, 3]
    assert len(set(positions)) == 4


def test_positions_stay_unique_after_filtered_anchor_move(
    db: Session,
    seed_tasks: list[Task],
) -> None:
    alpha, _bravo, charlie = seed_tasks
    task_ordering_service.move_task(
        db,
        BOOTSTRAP_USER_ID,
        charlie.id,
        TaskMove(
            target_column_id=COLUMN_TODO_ID,
            after_task_id=alpha.id,
            expected_version=1,
        ),
    )
    positions = list(
        db.scalars(select(Task.position).where(Task.column_id == COLUMN_TODO_ID)).all()
    )
    assert sorted(positions) == list(range(len(positions)))
    assert len(positions) == len(set(positions))
