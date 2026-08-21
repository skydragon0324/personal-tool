from __future__ import annotations

from datetime import date
from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy import inspect, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.constants import BOOTSTRAP_USER_ID, COLUMN_TODO_ID, DEFAULT_BOARD_ID
from app.db.base import Base
from app.models import Task, TaskRecurrenceSeries, User
from app.models.task_recurrence import (
    TaskRecurrenceAttachmentRef,
    TaskRecurrenceException,
    TaskRecurrenceLinkTemplate,
    TaskRecurrenceSubtaskTemplate,
)

FRIDAY = date(2026, 8, 21)
NEXT_FRIDAY = date(2026, 8, 28)


def _series(
    db: Session,
    *,
    category_id,
    title: str = "Weekly report",
    dtstart: date = FRIDAY,
) -> TaskRecurrenceSeries:
    series = TaskRecurrenceSeries(
        id=uuid4(),
        user_id=BOOTSTRAP_USER_ID,
        board_id=DEFAULT_BOARD_ID,
        default_column_id=COLUMN_TODO_ID,
        category_id=category_id,
        title=title,
        priority="medium",
        duration_days=0,
        timezone="UTC",
        freq="weekly",
        interval=1,
        weekdays=[4],
        status="active",
        dtstart=dtstart,
        version=1,
    )
    db.add(series)
    db.flush()
    return series


def _task(
    db: Session,
    *,
    category_id,
    position: int,
    title: str = "Occurrence",
    series_id=None,
    occurrence_date: date | None = None,
    original_occurrence_date: date | None = None,
) -> Task:
    task = Task(
        id=uuid4(),
        column_id=COLUMN_TODO_ID,
        category_id=category_id,
        title=title,
        start_date=occurrence_date or FRIDAY,
        due_date=occurrence_date or FRIDAY,
        priority="medium",
        position=position,
        version=1,
        recurrence_series_id=series_id,
        occurrence_date=occurrence_date,
        original_occurrence_date=original_occurrence_date,
        occurrence_index=1 if series_id is not None else None,
        is_detached=False,
    )
    db.add(task)
    db.flush()
    return task


def test_existing_task_supports_null_recurrence_fields(
    db: Session, today: date, uncategorized_id
) -> None:
    task = _task(db, category_id=uncategorized_id, position=200, title="One-off")
    db.refresh(task)
    assert task.recurrence_series_id is None
    assert task.occurrence_date is None
    assert task.original_occurrence_date is None
    assert task.occurrence_index is None
    assert task.is_detached is False


def test_recurrence_series_is_owned_by_one_user(db: Session, uncategorized_id) -> None:
    series = _series(db, category_id=uncategorized_id)
    owner = db.get(User, BOOTSTRAP_USER_ID)
    assert owner is not None
    assert series.user_id == owner.id
    assert db.scalar(select(TaskRecurrenceSeries).where(TaskRecurrenceSeries.id == series.id)) is not None


def test_task_occurrence_can_reference_series(db: Session, uncategorized_id) -> None:
    series = _series(db, category_id=uncategorized_id)
    task = _task(
        db,
        category_id=uncategorized_id,
        position=201,
        series_id=series.id,
        occurrence_date=FRIDAY,
        original_occurrence_date=FRIDAY,
    )
    db.refresh(task)
    assert task.recurrence_series_id == series.id
    assert task.occurrence_date == FRIDAY
    assert task.original_occurrence_date == FRIDAY


def test_duplicate_occurrence_identity_is_rejected(db: Session, uncategorized_id) -> None:
    series = _series(db, category_id=uncategorized_id)
    _task(
        db,
        category_id=uncategorized_id,
        position=202,
        series_id=series.id,
        occurrence_date=FRIDAY,
        original_occurrence_date=FRIDAY,
    )
    with pytest.raises(IntegrityError):
        _task(
            db,
            category_id=uncategorized_id,
            position=203,
            title="Duplicate",
            series_id=series.id,
            occurrence_date=FRIDAY,
            original_occurrence_date=FRIDAY,
        )


def test_different_dates_in_same_series_are_allowed(db: Session, uncategorized_id) -> None:
    series = _series(db, category_id=uncategorized_id)
    first = _task(
        db,
        category_id=uncategorized_id,
        position=204,
        series_id=series.id,
        occurrence_date=FRIDAY,
        original_occurrence_date=FRIDAY,
    )
    second = _task(
        db,
        category_id=uncategorized_id,
        position=205,
        title="Next week",
        series_id=series.id,
        occurrence_date=NEXT_FRIDAY,
        original_occurrence_date=NEXT_FRIDAY,
    )
    assert first.original_occurrence_date != second.original_occurrence_date
    assert first.recurrence_series_id == second.recurrence_series_id


def test_same_date_in_different_series_is_allowed(db: Session, uncategorized_id) -> None:
    first_series = _series(db, category_id=uncategorized_id, title="Series A")
    second_series = _series(db, category_id=uncategorized_id, title="Series B")
    first = _task(
        db,
        category_id=uncategorized_id,
        position=206,
        series_id=first_series.id,
        occurrence_date=FRIDAY,
        original_occurrence_date=FRIDAY,
    )
    second = _task(
        db,
        category_id=uncategorized_id,
        position=207,
        title="Other series",
        series_id=second_series.id,
        occurrence_date=FRIDAY,
        original_occurrence_date=FRIDAY,
    )
    assert first.original_occurrence_date == second.original_occurrence_date
    assert first.recurrence_series_id != second.recurrence_series_id


def test_one_off_tasks_are_not_constrained_by_occurrence_uniqueness(
    db: Session, uncategorized_id
) -> None:
    first = _task(
        db,
        category_id=uncategorized_id,
        position=208,
        title="Alpha",
        original_occurrence_date=FRIDAY,
    )
    second = _task(
        db,
        category_id=uncategorized_id,
        position=209,
        title="Bravo",
        original_occurrence_date=FRIDAY,
    )
    assert first.recurrence_series_id is None
    assert second.recurrence_series_id is None


def test_required_indexes_and_constraints_exist(db: Session) -> None:
    inspector = inspect(db.get_bind())
    series_indexes = {item["name"] for item in inspector.get_indexes("task_recurrence_series")}
    task_indexes = {item["name"] for item in inspector.get_indexes("tasks")}
    series_checks = {item["name"] for item in inspector.get_check_constraints("task_recurrence_series")}
    task_fk_names = {item["name"] for item in inspector.get_foreign_keys("tasks")}

    assert "ix_task_recurrence_series_user_id" in series_indexes
    assert "ix_task_recurrence_series_board_id" in series_indexes
    assert "ix_task_recurrence_series_user_status" in series_indexes
    assert "ix_tasks_recurrence_series_id" in task_indexes
    assert "ix_tasks_series_occurrence_date" in task_indexes
    assert "uq_tasks_series_original_occurrence" in task_indexes
    assert "fk_tasks_recurrence_series_id" in task_fk_names
    assert "ck_task_recurrence_freq" in series_checks
    assert "ck_task_recurrence_interval" in series_checks
    assert "ck_task_recurrence_limit" in series_checks
    assert "ck_task_recurrence_status" in series_checks

    fk_actions = {
        row.conname: row.action
        for row in db.execute(
            text(
                """
                SELECT c.conname,
                       CASE c.confdeltype
                           WHEN 'c' THEN 'CASCADE'
                           WHEN 'n' THEN 'SET NULL'
                           WHEN 'r' THEN 'RESTRICT'
                           WHEN 'a' THEN 'NO ACTION'
                           ELSE c.confdeltype::text
                       END AS action
                FROM pg_constraint c
                JOIN pg_class rel ON rel.oid = c.conrelid
                WHERE c.contype = 'f'
                  AND rel.relname IN ('tasks', 'task_recurrence_series')
                """
            )
        )
    }
    assert fk_actions["fk_tasks_recurrence_series_id"] == "SET NULL"
    assert "CASCADE" in {fk_actions[name] for name in fk_actions if "user_id" in name or name.endswith("user_id_fkey")}
    user_fk = next(name for name in fk_actions if name.endswith("user_id_fkey") and "series" in name)
    board_fk = next(name for name in fk_actions if name.endswith("board_id_fkey") and "series" in name)
    column_fk = next(name for name in fk_actions if "default_column" in name)
    category_fk = next(name for name in fk_actions if name.endswith("category_id_fkey") and "series" in name)
    assert fk_actions[user_fk] == "CASCADE"
    assert fk_actions[board_fk] == "CASCADE"
    assert fk_actions[column_fk] == "SET NULL"
    assert fk_actions[category_fk] == "RESTRICT"


def test_model_imports_and_metadata_load() -> None:
    assert "task_recurrence_series" in Base.metadata.tables
    assert "task_recurrence_exceptions" in Base.metadata.tables
    assert "tasks" in Base.metadata.tables
    assert TaskRecurrenceSeries.__tablename__ == "task_recurrence_series"
    assert TaskRecurrenceException.__tablename__ == "task_recurrence_exceptions"
    assert TaskRecurrenceSubtaskTemplate.__tablename__ == "task_recurrence_subtask_templates"
    assert TaskRecurrenceLinkTemplate.__tablename__ == "task_recurrence_link_templates"
    assert TaskRecurrenceAttachmentRef.__tablename__ == "task_recurrence_attachment_refs"
    index_names = {index.name for index in Task.__table__.indexes}
    assert "uq_tasks_series_original_occurrence" in index_names
    assert "ix_tasks_series_occurrence_date" in index_names


def test_migration_upgrade_and_downgrade_structure() -> None:
    path = Path(__file__).resolve().parents[2] / "alembic" / "versions" / "014_task_recurrence.py"
    source = path.read_text(encoding="utf-8")
    upgrade = source.split("def upgrade()")[1].split("def downgrade()")[0]
    downgrade = source.split("def downgrade()")[1]
    assert 'revision: str = "014_task_recurrence"' in source
    assert 'down_revision: Union[str, None] = "013_inbox_items"' in source
    assert upgrade.index('op.create_table(\n        "task_recurrence_series"') < upgrade.index(
        'op.add_column("tasks", sa.Column("recurrence_series_id"'
    )
    assert downgrade.index('op.drop_column("tasks", "recurrence_series_id")') < downgrade.index(
        'op.drop_table("task_recurrence_series")'
    )
    assert "drop_table(\"inbox_items\")" not in source
    assert 'drop_table("tasks")' not in source


def test_deleting_series_does_not_delete_occurrence_rows(db: Session, uncategorized_id) -> None:
    series = _series(db, category_id=uncategorized_id)
    task = _task(
        db,
        category_id=uncategorized_id,
        position=210,
        series_id=series.id,
        occurrence_date=FRIDAY,
        original_occurrence_date=FRIDAY,
    )
    task_id = task.id
    db.delete(series)
    db.flush()
    remaining = db.get(Task, task_id)
    assert remaining is not None
    assert remaining.recurrence_series_id is None
