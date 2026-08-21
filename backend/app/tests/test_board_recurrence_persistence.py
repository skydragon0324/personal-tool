from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, date, datetime
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.constants import BOOTSTRAP_USER_ID
from app.models import Board, BoardColumn, Category, Task, User
from app.models.task_recurrence import TaskRecurrenceSeries
from app.schemas.board import BoardCreate
from app.schemas.recurrence import RecurrenceInput
from app.schemas.task import Priority, TaskCreate
from app.services import board_service, recurrence_service, today_service

DTSTART = date(2026, 1, 2)  # Friday
MISSING = date(2026, 3, 6)  # Friday outside create-time horizon (today → today+62)
OUTSIDE = date(2026, 6, 15)


@contextmanager
def independent_session(engine: Engine) -> Iterator[Session]:
    """One request-shaped session: close without an implicit commit, matching get_db()."""
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _make_board(engine: Engine) -> tuple[UUID, UUID, UUID]:
    with independent_session(engine) as db:
        created = board_service.create_board(
            db,
            BOOTSTRAP_USER_ID,
            BoardCreate(name=f"Recur persist {uuid4().hex[:8]}"),
        )
        db.commit()
        columns = list(
            db.scalars(
                select(BoardColumn)
                .where(BoardColumn.board_id == created.id, BoardColumn.archived_at.is_(None))
                .order_by(BoardColumn.position)
            ).all()
        )
        todo = next(column for column in columns if not column.is_done)
        category = db.scalar(
            select(Category).where(Category.board_id == created.id).order_by(Category.position)
        )
        assert category is not None
        return created.id, todo.id, category.id


def _create_weekly_series(
    engine: Engine,
    *,
    title: str,
    column_id: UUID,
    category_id: UUID,
    until_date: date | None = None,
    occurrence_limit: int | None = None,
) -> UUID:
    with independent_session(engine) as db:
        created = recurrence_service.create_recurring_task(
            db,
            BOOTSTRAP_USER_ID,
            TaskCreate(
                column_id=column_id,
                category_id=category_id,
                title=title,
                start_date=DTSTART,
                due_date=DTSTART,
                priority=Priority.medium,
                recurrence=RecurrenceInput(
                    freq="weekly",
                    interval=1,
                    weekdays=[4],
                    until_date=until_date,
                    occurrence_limit=occurrence_limit,
                ),
            ),
        )
        assert created.recurrence is not None
        return created.recurrence.series_id


def _count_occurrence(engine: Engine, series_id: UUID, occurrence: date) -> int:
    with independent_session(engine) as db:
        return int(
            db.scalar(
                select(func.count(Task.id)).where(
                    Task.recurrence_series_id == series_id,
                    Task.original_occurrence_date == occurrence,
                )
            )
            or 0
        )


def _delete_board(engine: Engine, board_id: UUID) -> None:
    with independent_session(engine) as db:
        series_rows = list(
            db.scalars(select(TaskRecurrenceSeries).where(TaskRecurrenceSeries.board_id == board_id)).all()
        )
        series_ids = [series.id for series in series_rows]
        if series_ids:
            tasks = list(db.scalars(select(Task).where(Task.recurrence_series_id.in_(series_ids))).all())
            for task in tasks:
                db.delete(task)
            for series in series_rows:
                db.delete(series)
        board = db.get(Board, board_id)
        if board is not None:
            db.delete(board)
        db.commit()


@pytest.fixture(autouse=True)
def _cleanup_persist_boards(test_engine: Engine) -> Iterator[None]:
    yield
    with independent_session(test_engine) as db:
        leftovers = list(
            db.scalars(
                select(Board).where(
                    Board.user_id == BOOTSTRAP_USER_ID,
                    Board.name.like("Recur persist %"),
                )
            ).all()
        )
        leftover_ids = [board.id for board in leftovers]
    for board_id in leftover_ids:
        _delete_board(test_engine, board_id)


def test_board_range_generation_persists_across_independent_sessions(test_engine: Engine) -> None:
    """Opening a Board range must commit generated occurrences; flush() is not persistence."""
    board_id, column_id, category_id = _make_board(test_engine)
    title = f"Persist {uuid4().hex[:8]}"
    series_id = _create_weekly_series(
        test_engine, title=title, column_id=column_id, category_id=category_id
    )
    try:
        assert _count_occurrence(test_engine, series_id, MISSING) == 0

        generated_id = None
        with independent_session(test_engine) as db:
            view = board_service.get_board_view(
                db,
                BOOTSTRAP_USER_ID,
                board_id,
                start_date=MISSING,
                end_date=MISSING,
            )
            found = [
                task
                for column in view.columns
                for task in column.tasks
                if task.title == title and task.due_date == MISSING
            ]
            assert found, "Board response should include the generated occurrence"
            generated_id = found[0].id

        with independent_session(test_engine) as db:
            persisted = db.get(Task, generated_id)
            assert persisted is not None, "occurrence was rolled back when the Board request session closed"
            assert persisted.original_occurrence_date == MISSING
            assert persisted.recurrence_series_id == series_id
    finally:
        _delete_board(test_engine, board_id)


def test_second_board_request_does_not_duplicate_occurrence(test_engine: Engine) -> None:
    board_id, column_id, category_id = _make_board(test_engine)
    title = f"Idempotent {uuid4().hex[:8]}"
    series_id = _create_weekly_series(
        test_engine, title=title, column_id=column_id, category_id=category_id
    )
    try:
        for _ in range(2):
            with independent_session(test_engine) as db:
                board_service.get_board_view(
                    db,
                    BOOTSTRAP_USER_ID,
                    board_id,
                    start_date=MISSING,
                    end_date=MISSING,
                )
        assert _count_occurrence(test_engine, series_id, MISSING) == 1
    finally:
        _delete_board(test_engine, board_id)


def test_other_user_cannot_view_or_generate_owner_occurrences(test_engine: Engine) -> None:
    board_id, column_id, category_id = _make_board(test_engine)
    title = f"Owned {uuid4().hex[:8]}"
    series_id = _create_weekly_series(
        test_engine, title=title, column_id=column_id, category_id=category_id
    )
    other_id = None
    try:
        with independent_session(test_engine) as db:
            other = User(
                email=f"other-{uuid4().hex[:8]}@example.com",
                display_name="Other",
                password_hash="x",
                timezone="UTC",
            )
            db.add(other)
            db.commit()
            db.refresh(other)
            other_id = other.id

        with independent_session(test_engine) as db:
            with pytest.raises(HTTPException) as exc:
                board_service.get_board_view(
                    db,
                    other_id,
                    board_id,
                    start_date=MISSING,
                    end_date=MISSING,
                )
            assert exc.value.status_code == 404

        assert _count_occurrence(test_engine, series_id, MISSING) == 0
    finally:
        _delete_board(test_engine, board_id)
        if other_id is not None:
            with independent_session(test_engine) as db:
                row = db.get(User, other_id)
                if row is not None:
                    db.delete(row)
                    db.commit()


def test_today_sees_occurrence_generated_through_board(test_engine: Engine) -> None:
    board_id, column_id, category_id = _make_board(test_engine)
    title = f"Today sees {uuid4().hex[:8]}"
    series_id = _create_weekly_series(
        test_engine, title=title, column_id=column_id, category_id=category_id
    )
    try:
        generated_id = None
        with independent_session(test_engine) as db:
            view = board_service.get_board_view(
                db,
                BOOTSTRAP_USER_ID,
                board_id,
                start_date=MISSING,
                end_date=MISSING,
            )
            found = [
                task
                for column in view.columns
                for task in column.tasks
                if task.title == title and task.due_date == MISSING
            ]
            assert found
            generated_id = found[0].id

        with independent_session(test_engine) as db:
            today = today_service.get_today(db, BOOTSTRAP_USER_ID, MISSING)
            ids = {item.id for item in today.active_tasks}
            assert generated_id in ids
        assert _count_occurrence(test_engine, series_id, MISSING) == 1
    finally:
        _delete_board(test_engine, board_id)


def test_board_range_outside_recurrence_dates_creates_nothing(test_engine: Engine) -> None:
    board_id, column_id, category_id = _make_board(test_engine)
    title = f"Ended {uuid4().hex[:8]}"
    series_id = _create_weekly_series(
        test_engine,
        title=title,
        column_id=column_id,
        category_id=category_id,
        until_date=date(2026, 1, 31),
    )
    try:
        with independent_session(test_engine) as db:
            view = board_service.get_board_view(
                db,
                BOOTSTRAP_USER_ID,
                board_id,
                start_date=OUTSIDE,
                end_date=OUTSIDE,
            )
            stray = [
                task
                for column in view.columns
                for task in column.tasks
                if task.title == title and task.due_date == OUTSIDE
            ]
            assert stray == []
        assert _count_occurrence(test_engine, series_id, OUTSIDE) == 0
    finally:
        _delete_board(test_engine, board_id)


def test_stopped_series_generates_nothing(test_engine: Engine) -> None:
    board_id, column_id, category_id = _make_board(test_engine)
    title = f"Stopped {uuid4().hex[:8]}"
    series_id = _create_weekly_series(
        test_engine, title=title, column_id=column_id, category_id=category_id
    )
    try:
        with independent_session(test_engine) as db:
            recurrence_service.stop_series(db, BOOTSTRAP_USER_ID, series_id)
        with independent_session(test_engine) as db:
            board_service.get_board_view(
                db,
                BOOTSTRAP_USER_ID,
                board_id,
                start_date=MISSING,
                end_date=MISSING,
            )
        assert _count_occurrence(test_engine, series_id, MISSING) == 0
    finally:
        _delete_board(test_engine, board_id)


def test_archived_board_does_not_generate_invalid_tasks(test_engine: Engine) -> None:
    board_id, column_id, category_id = _make_board(test_engine)
    title = f"Archived board {uuid4().hex[:8]}"
    series_id = _create_weekly_series(
        test_engine, title=title, column_id=column_id, category_id=category_id
    )
    try:
        with independent_session(test_engine) as db:
            board = db.get(Board, board_id)
            assert board is not None
            board.archived_at = datetime.now(UTC)
            db.commit()
        with independent_session(test_engine) as db:
            board_service.get_board_view(
                db,
                BOOTSTRAP_USER_ID,
                board_id,
                start_date=MISSING,
                end_date=MISSING,
            )
        assert _count_occurrence(test_engine, series_id, MISSING) == 0
    finally:
        _delete_board(test_engine, board_id)


def test_unavailable_starting_status_does_not_generate(test_engine: Engine) -> None:
    board_id, column_id, category_id = _make_board(test_engine)
    title = f"Archived column {uuid4().hex[:8]}"
    series_id = _create_weekly_series(
        test_engine, title=title, column_id=column_id, category_id=category_id
    )
    try:
        with independent_session(test_engine) as db:
            columns = list(
                db.scalars(
                    select(BoardColumn).where(
                        BoardColumn.board_id == board_id,
                        BoardColumn.is_done.is_(False),
                    )
                ).all()
            )
            now = datetime.now(UTC)
            for column in columns:
                column.archived_at = now
            db.commit()
        with independent_session(test_engine) as db:
            board_service.get_board_view(
                db,
                BOOTSTRAP_USER_ID,
                board_id,
                start_date=MISSING,
                end_date=MISSING,
            )
        assert _count_occurrence(test_engine, series_id, MISSING) == 0
    finally:
        _delete_board(test_engine, board_id)
