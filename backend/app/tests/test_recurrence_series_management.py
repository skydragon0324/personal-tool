from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, date, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.constants import BOOTSTRAP_USER_ID
from app.models import Board, BoardColumn, Category, Task, User
from app.models.task_recurrence import TaskRecurrenceException, TaskRecurrenceSeries
from app.schemas.board import BoardCreate
from app.schemas.recurrence import RecurrenceInput
from app.schemas.task import Priority, TaskCreate, TaskMove, TaskUpdate
from app.services import board_service, recurrence_service, task_ordering_service, task_service

FRIDAY = date(2026, 8, 21)
NEXT_FRIDAY = date(2026, 8, 28)
THIRD_FRIDAY = date(2026, 9, 4)


@contextmanager
def independent_session(engine: Engine) -> Iterator[Session]:
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


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


@pytest.fixture
def manage_board(test_engine: Engine) -> Iterator[tuple[Engine, UUID, UUID, UUID, UUID]]:
    with independent_session(test_engine) as db:
        created = board_service.create_board(
            db,
            BOOTSTRAP_USER_ID,
            BoardCreate(name=f"Recur manage {uuid4().hex[:8]}"),
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
        done = next(column for column in columns if column.is_done)
        category = db.scalar(
            select(Category).where(Category.board_id == created.id).order_by(Category.position)
        )
        assert category is not None
        board_id, todo_id, done_id, category_id = created.id, todo.id, done.id, category.id
    try:
        yield test_engine, board_id, todo_id, done_id, category_id
    finally:
        _delete_board(test_engine, board_id)


def _create_series(
    engine: Engine,
    *,
    column_id: UUID,
    category_id: UUID,
    title: str,
    start: date = FRIDAY,
    recurrence: RecurrenceInput | None = None,
    timezone: str = "UTC",
) -> UUID:
    with independent_session(engine) as db:
        created = recurrence_service.create_recurring_task(
            db,
            BOOTSTRAP_USER_ID,
            TaskCreate(
                column_id=column_id,
                category_id=category_id,
                title=title,
                start_date=start,
                due_date=start,
                priority=Priority.medium,
                recurrence=recurrence or RecurrenceInput(freq="weekly", interval=1, weekdays=[4]),
            ),
        )
        assert created.recurrence is not None
        series_id = created.recurrence.series_id
        series = db.get(TaskRecurrenceSeries, series_id)
        assert series is not None
        series.timezone = timezone
        db.commit()
        return series_id


def _list(
    engine: Engine,
    *,
    board_id: UUID | None = None,
    status: str | None = None,
    offset: int = 0,
    limit: int = 50,
):
    with independent_session(engine) as db:
        return recurrence_service.list_series(
            db,
            BOOTSTRAP_USER_ID,
            board_id=board_id,
            status=status,
            offset=offset,
            limit=limit,
        )


def _item(engine: Engine, board_id: UUID, series_id: UUID):
    listed = _list(engine, board_id=board_id)
    found = next((item for item in listed.items if item.id == series_id), None)
    assert found is not None
    return found


def _set_status(engine: Engine, series_id: UUID, status: str) -> None:
    with independent_session(engine) as db:
        series = db.get(TaskRecurrenceSeries, series_id)
        assert series is not None
        series.status = status
        db.commit()


def _set_updated_at(engine: Engine, series_id: UUID, value: datetime) -> None:
    with independent_session(engine) as db:
        series = db.get(TaskRecurrenceSeries, series_id)
        assert series is not None
        series.updated_at = value
        db.commit()


def _occurrence(engine: Engine, series_id: UUID, original: date) -> Task:
    with independent_session(engine) as db:
        row = db.scalar(
            select(Task).where(
                Task.recurrence_series_id == series_id,
                Task.original_occurrence_date == original,
            )
        )
        assert row is not None, f"missing occurrence {original.isoformat()}"
        db.expunge(row)
        return row


def _task_count(engine: Engine, series_id: UUID) -> int:
    with independent_session(engine) as db:
        return int(
            db.scalar(select(func.count()).select_from(Task).where(Task.recurrence_series_id == series_id)) or 0
        )


def _next_weekday_on_or_after(day: date, weekday: int) -> date:
    return day + timedelta(days=(weekday - day.weekday()) % 7)


def _exception_dates(engine: Engine, series_id: UUID) -> set[date]:
    with independent_session(engine) as db:
        return set(
            db.scalars(
                select(TaskRecurrenceException.original_occurrence_date).where(
                    TaskRecurrenceException.series_id == series_id
                )
            ).all()
        )


def test_list_returns_only_authenticated_user_series(manage_board) -> None:
    engine, board_id, column_id, _done_id, category_id = manage_board
    owned = _create_series(engine, column_id=column_id, category_id=category_id, title="Mine")
    other_id = None
    other_board_id = None
    try:
        with independent_session(engine) as db:
            other = User(
                email=f"manage-other-{uuid4().hex[:8]}@example.com",
                display_name="Other",
                password_hash="x",
                timezone="UTC",
            )
            db.add(other)
            db.commit()
            db.refresh(other)
            other_id = other.id
            other_board = board_service.create_board(db, other_id, BoardCreate(name=f"Other {uuid4().hex[:8]}"))
            db.commit()
            other_board_id = other_board.id
            todo = db.scalar(
                select(BoardColumn)
                .where(BoardColumn.board_id == other_board.id, BoardColumn.is_done.is_(False))
                .order_by(BoardColumn.position)
            )
            category = db.scalar(select(Category).where(Category.board_id == other_board.id))
            assert todo is not None and category is not None
            stolen = recurrence_service.create_recurring_task(
                db,
                other_id,
                TaskCreate(
                    column_id=todo.id,
                    category_id=category.id,
                    title="Not yours",
                    start_date=FRIDAY,
                    due_date=FRIDAY,
                    recurrence=RecurrenceInput(freq="weekly", weekdays=[4]),
                ),
            )
            assert stolen.recurrence is not None
            other_series_id = stolen.recurrence.series_id
        listed = _list(engine)
        ids = {item.id for item in listed.items}
        assert owned in ids
        assert other_series_id not in ids
    finally:
        if other_board_id is not None:
            _delete_board(engine, other_board_id)
        if other_id is not None:
            with independent_session(engine) as db:
                row = db.get(User, other_id)
                if row is not None:
                    db.delete(row)
                    db.commit()


def test_list_filters_by_board(manage_board) -> None:
    engine, board_id, column_id, _done_id, category_id = manage_board
    first = _create_series(engine, column_id=column_id, category_id=category_id, title="On board")
    with independent_session(engine) as db:
        other = board_service.create_board(
            db, BOOTSTRAP_USER_ID, BoardCreate(name=f"Recur manage other {uuid4().hex[:8]}")
        )
        db.commit()
        other_board_id = other.id
        todo = db.scalar(
            select(BoardColumn)
            .where(BoardColumn.board_id == other.id, BoardColumn.is_done.is_(False))
            .order_by(BoardColumn.position)
        )
        category = db.scalar(select(Category).where(Category.board_id == other.id))
        assert todo is not None and category is not None
        todo_id, cat_id = todo.id, category.id
    try:
        second = _create_series(engine, column_id=todo_id, category_id=cat_id, title="Elsewhere")
        listed = _list(engine, board_id=board_id)
        ids = {item.id for item in listed.items}
        assert first in ids
        assert second not in ids
    finally:
        _delete_board(engine, other_board_id)


def test_list_filters_by_active_status(manage_board) -> None:
    engine, board_id, column_id, _done_id, category_id = manage_board
    active = _create_series(engine, column_id=column_id, category_id=category_id, title="Active")
    stopped = _create_series(engine, column_id=column_id, category_id=category_id, title="Stopped")
    with independent_session(engine) as db:
        recurrence_service.stop_series(db, BOOTSTRAP_USER_ID, stopped)
    listed = _list(engine, board_id=board_id, status="active")
    ids = {item.id for item in listed.items}
    assert active in ids
    assert stopped not in ids
    assert all(item.status == "active" for item in listed.items)


def test_list_filters_by_stopped_status(manage_board) -> None:
    engine, board_id, column_id, _done_id, category_id = manage_board
    active = _create_series(engine, column_id=column_id, category_id=category_id, title="Active")
    stopped = _create_series(engine, column_id=column_id, category_id=category_id, title="Stopped")
    with independent_session(engine) as db:
        recurrence_service.stop_series(db, BOOTSTRAP_USER_ID, stopped)
    listed = _list(engine, board_id=board_id, status="stopped")
    ids = {item.id for item in listed.items}
    assert stopped in ids
    assert active not in ids
    assert all(item.status == "stopped" for item in listed.items)


def test_list_pagination_and_total(manage_board) -> None:
    engine, board_id, column_id, _done_id, category_id = manage_board
    created = [
        _create_series(engine, column_id=column_id, category_id=category_id, title=f"Page {index}")
        for index in range(3)
    ]
    first = _list(engine, board_id=board_id, offset=0, limit=2)
    second = _list(engine, board_id=board_id, offset=2, limit=2)
    assert first.total == 3
    assert first.offset == 0
    assert first.limit == 2
    assert len(first.items) == 2
    assert second.total == 3
    assert len(second.items) == 1
    assert {item.id for item in first.items + second.items} == set(created)


def test_list_uses_deterministic_ordering(manage_board) -> None:
    engine, board_id, column_id, _done_id, category_id = manage_board
    later_next = _create_series(
        engine,
        column_id=column_id,
        category_id=category_id,
        title="Monday",
        recurrence=RecurrenceInput(freq="weekly", weekdays=[0]),
    )
    sooner_next = _create_series(
        engine,
        column_id=column_id,
        category_id=category_id,
        title="Friday",
        recurrence=RecurrenceInput(freq="weekly", weekdays=[4]),
    )
    stopped = _create_series(engine, column_id=column_id, category_id=category_id, title="Stopped")
    with independent_session(engine) as db:
        recurrence_service.stop_series(db, BOOTSTRAP_USER_ID, stopped)
    now = datetime.now(UTC)
    _set_updated_at(engine, stopped, now)
    _set_updated_at(engine, later_next, now - timedelta(days=2))
    _set_updated_at(engine, sooner_next, now - timedelta(days=1))
    listed = _list(engine, board_id=board_id)
    ids = [item.id for item in listed.items]
    friday_next = next(item.next_occurrence_date for item in listed.items if item.id == sooner_next)
    monday_next = next(item.next_occurrence_date for item in listed.items if item.id == later_next)
    assert friday_next is not None and monday_next is not None
    if friday_next <= monday_next:
        assert ids[:2] == [sooner_next, later_next]
    else:
        assert ids[:2] == [later_next, sooner_next]
    assert ids[2] == stopped
    assert listed.items[2].next_occurrence_date is None


def test_list_includes_board_column_and_category_display(manage_board) -> None:
    engine, board_id, column_id, _done_id, category_id = manage_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Labels")
    with independent_session(engine) as db:
        board = db.get(Board, board_id)
        column = db.get(BoardColumn, column_id)
        category = db.get(Category, category_id)
        assert board is not None and column is not None and category is not None
        board_name, column_name, category_name = board.name, column.name, category.name
    item = _item(engine, board_id, series_id)
    assert item.board_id == board_id
    assert item.board_name == board_name
    assert item.board_archived is False
    assert item.default_column_id == column_id
    assert item.default_column_name == column_name
    assert item.category_id == category_id
    assert item.category_name == category_name
    assert item.title == "Labels"
    assert item.start_date == FRIDAY


def test_list_counts_open_completed_and_detached(manage_board) -> None:
    engine, board_id, column_id, done_id, category_id = manage_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Counts")
    first = _occurrence(engine, series_id, FRIDAY)
    second = _occurrence(engine, series_id, NEXT_FRIDAY)
    with independent_session(engine) as db:
        task_ordering_service.move_task(
            db,
            BOOTSTRAP_USER_ID,
            first.id,
            TaskMove(target_column_id=done_id, expected_version=first.version, target_position=0),
        )
        task_service.update_task(
            db,
            BOOTSTRAP_USER_ID,
            second.id,
            TaskUpdate(title="Custom", edit_scope="this"),
        )
    item = _item(engine, board_id, series_id)
    with independent_session(engine) as db:
        total = int(
            db.scalar(select(func.count()).select_from(Task).where(Task.recurrence_series_id == series_id)) or 0
        )
    assert item.completed_occurrence_count == 1
    assert item.detached_occurrence_count == 1
    assert item.open_occurrence_count == total - 1
    assert item.open_occurrence_count >= 1


def test_next_occurrence_respects_timezone_and_start_date(manage_board) -> None:
    engine, board_id, column_id, _done_id, category_id = manage_board
    utc_series = _create_series(
        engine, column_id=column_id, category_id=category_id, title="UTC Friday", timezone="UTC"
    )
    auckland = _create_series(
        engine,
        column_id=column_id,
        category_id=category_id,
        title="Auckland Friday",
        timezone="Pacific/Auckland",
    )
    future = _create_series(
        engine,
        column_id=column_id,
        category_id=category_id,
        title="Starts later",
        start=NEXT_FRIDAY,
        timezone="UTC",
    )
    utc_today = recurrence_service.calendar_today("UTC")
    auckland_today = recurrence_service.calendar_today("Pacific/Auckland")
    utc_item = _item(engine, board_id, utc_series)
    auckland_item = _item(engine, board_id, auckland)
    future_item = _item(engine, board_id, future)
    assert utc_item.next_occurrence_date == _next_weekday_on_or_after(utc_today, 4)
    assert auckland_item.next_occurrence_date == _next_weekday_on_or_after(auckland_today, 4)
    assert future_item.next_occurrence_date == NEXT_FRIDAY
    assert future_item.start_date == NEXT_FRIDAY


def test_next_occurrence_respects_until_date(manage_board) -> None:
    engine, board_id, column_id, _done_id, category_id = manage_board
    series_id = _create_series(
        engine,
        column_id=column_id,
        category_id=category_id,
        title="Until June",
        start=date(2025, 1, 15),
        recurrence=RecurrenceInput(freq="yearly", until_date=date(2026, 6, 1)),
    )
    assert _item(engine, board_id, series_id).next_occurrence_date is None


def test_next_occurrence_respects_occurrence_limit(manage_board) -> None:
    engine, board_id, column_id, _done_id, category_id = manage_board
    series_id = _create_series(
        engine,
        column_id=column_id,
        category_id=category_id,
        title="One shot",
        start=date(2026, 8, 7),
        recurrence=RecurrenceInput(freq="weekly", weekdays=[4], occurrence_limit=1),
    )
    assert _item(engine, board_id, series_id).next_occurrence_date is None


def test_next_occurrence_skips_exceptions(manage_board) -> None:
    engine, board_id, column_id, _done_id, category_id = manage_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Skip today")
    selected = _occurrence(engine, series_id, FRIDAY)
    with independent_session(engine) as db:
        task_service.delete_task(db, BOOTSTRAP_USER_ID, selected.id, delete_scope="this")
    assert _item(engine, board_id, series_id).next_occurrence_date == NEXT_FRIDAY


def test_stopped_and_archived_have_no_next_occurrence(manage_board) -> None:
    engine, board_id, column_id, _done_id, category_id = manage_board
    stopped = _create_series(engine, column_id=column_id, category_id=category_id, title="Stopped")
    archived = _create_series(engine, column_id=column_id, category_id=category_id, title="Archived")
    with independent_session(engine) as db:
        recurrence_service.stop_series(db, BOOTSTRAP_USER_ID, stopped)
    _set_status(engine, archived, "archived")
    assert _item(engine, board_id, stopped).next_occurrence_date is None
    assert _item(engine, board_id, archived).next_occurrence_date is None
    assert _item(engine, board_id, archived).status == "archived"


def test_far_future_yearly_next_occurrence(manage_board) -> None:
    engine, board_id, column_id, _done_id, category_id = manage_board
    series_id = _create_series(
        engine,
        column_id=column_id,
        category_id=category_id,
        title="Leap day",
        start=date(2024, 2, 29),
        recurrence=RecurrenceInput(freq="yearly"),
    )
    assert _item(engine, board_id, series_id).next_occurrence_date == date(2028, 2, 29)


def test_resume_stopped_series(manage_board) -> None:
    engine, _board_id, column_id, _done_id, category_id = manage_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Resume me")
    with independent_session(engine) as db:
        stopped = recurrence_service.stop_series(db, BOOTSTRAP_USER_ID, series_id)
        assert stopped.status == "stopped"
        version = db.get(TaskRecurrenceSeries, series_id)
        assert version is not None
        previous = version.version
    with independent_session(engine) as db:
        resumed = recurrence_service.resume_series(db, BOOTSTRAP_USER_ID, series_id)
    assert resumed.status == "active"
    with independent_session(engine) as db:
        series = db.get(TaskRecurrenceSeries, series_id)
        assert series is not None
        assert series.status == "active"
        assert series.version > previous


def test_resume_generates_next_occurrence(manage_board) -> None:
    engine, _board_id, column_id, _done_id, category_id = manage_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Generate next")
    selected = _occurrence(engine, series_id, FRIDAY)
    with independent_session(engine) as db:
        task_service.delete_task(db, BOOTSTRAP_USER_ID, selected.id, delete_scope="series")
    assert _occurrence_missing(engine, series_id, FRIDAY)
    assert _occurrence_missing(engine, series_id, NEXT_FRIDAY)
    with independent_session(engine) as db:
        recurrence_service.resume_series(db, BOOTSTRAP_USER_ID, series_id)
    assert not _occurrence_missing(engine, series_id, FRIDAY)
    assert not _occurrence_missing(engine, series_id, NEXT_FRIDAY)


def _occurrence_missing(engine: Engine, series_id: UUID, original: date) -> bool:
    with independent_session(engine) as db:
        return (
            db.scalar(
                select(Task.id).where(
                    Task.recurrence_series_id == series_id,
                    Task.original_occurrence_date == original,
                )
            )
            is None
        )


def test_repeated_resume_is_idempotent(manage_board) -> None:
    engine, _board_id, column_id, _done_id, category_id = manage_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Idempotent")
    with independent_session(engine) as db:
        first = recurrence_service.resume_series(db, BOOTSTRAP_USER_ID, series_id)
        series = db.get(TaskRecurrenceSeries, series_id)
        assert series is not None
        version = series.version
    count = _task_count(engine, series_id)
    with independent_session(engine) as db:
        second = recurrence_service.resume_series(db, BOOTSTRAP_USER_ID, series_id)
        series = db.get(TaskRecurrenceSeries, series_id)
        assert series is not None
        assert series.version == version
    assert first.status == "active"
    assert second.status == "active"
    assert _task_count(engine, series_id) == count
    with independent_session(engine) as db:
        originals = list(
            db.scalars(select(Task.original_occurrence_date).where(Task.recurrence_series_id == series_id)).all()
        )
        assert len(originals) == len(set(originals))


def test_resume_preserves_exceptions(manage_board) -> None:
    engine, _board_id, column_id, _done_id, category_id = manage_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Keep skip")
    selected = _occurrence(engine, series_id, NEXT_FRIDAY)
    with independent_session(engine) as db:
        task_service.delete_task(db, BOOTSTRAP_USER_ID, selected.id, delete_scope="this")
        recurrence_service.stop_series(db, BOOTSTRAP_USER_ID, series_id)
    assert NEXT_FRIDAY in _exception_dates(engine, series_id)
    with independent_session(engine) as db:
        recurrence_service.resume_series(db, BOOTSTRAP_USER_ID, series_id)
    assert NEXT_FRIDAY in _exception_dates(engine, series_id)
    assert _occurrence_missing(engine, series_id, NEXT_FRIDAY)


def test_resume_after_all_unfinished_can_generate_again(manage_board) -> None:
    engine, _board_id, column_id, _done_id, category_id = manage_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Rebuild")
    selected = _occurrence(engine, series_id, NEXT_FRIDAY)
    with independent_session(engine) as db:
        task_service.delete_task(db, BOOTSTRAP_USER_ID, selected.id, delete_scope="series")
    with independent_session(engine) as db:
        series = db.get(TaskRecurrenceSeries, series_id)
        assert series is not None
        assert series.status == "stopped"
        recurrence_service.resume_series(db, BOOTSTRAP_USER_ID, series_id)
    assert not _occurrence_missing(engine, series_id, FRIDAY)
    assert not _occurrence_missing(engine, series_id, NEXT_FRIDAY)


def test_resume_fails_for_archived_board(manage_board) -> None:
    engine, board_id, column_id, _done_id, category_id = manage_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Archived board")
    with independent_session(engine) as db:
        recurrence_service.stop_series(db, BOOTSTRAP_USER_ID, series_id)
        board_service.archive_board(db, BOOTSTRAP_USER_ID, board_id)
    with pytest.raises(HTTPException) as exc:
        with independent_session(engine) as db:
            recurrence_service.resume_series(db, BOOTSTRAP_USER_ID, series_id)
    assert exc.value.status_code == 409
    with independent_session(engine) as db:
        series = db.get(TaskRecurrenceSeries, series_id)
        assert series is not None
        assert series.status == "stopped"


def test_resume_fails_for_unavailable_or_done_default_status(manage_board) -> None:
    engine, _board_id, column_id, done_id, category_id = manage_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Done default")
    with independent_session(engine) as db:
        recurrence_service.stop_series(db, BOOTSTRAP_USER_ID, series_id)
        series = db.get(TaskRecurrenceSeries, series_id)
        assert series is not None
        series.default_column_id = done_id
        db.commit()
    with pytest.raises(HTTPException) as exc:
        with independent_session(engine) as db:
            recurrence_service.resume_series(db, BOOTSTRAP_USER_ID, series_id)
    assert exc.value.status_code == 409
    archived_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Archived column")
    with independent_session(engine) as db:
        recurrence_service.stop_series(db, BOOTSTRAP_USER_ID, archived_id)
        column = db.get(BoardColumn, column_id)
        assert column is not None
        column.archived_at = datetime.now(UTC)
        db.commit()
    with pytest.raises(HTTPException) as archived_exc:
        with independent_session(engine) as db:
            recurrence_service.resume_series(db, BOOTSTRAP_USER_ID, archived_id)
    assert archived_exc.value.status_code == 409


def test_resume_fails_when_rule_has_no_future_occurrence(manage_board) -> None:
    engine, _board_id, column_id, _done_id, category_id = manage_board
    series_id = _create_series(
        engine,
        column_id=column_id,
        category_id=category_id,
        title="Ended",
        start=date(2025, 1, 15),
        recurrence=RecurrenceInput(freq="yearly", until_date=date(2026, 6, 1)),
    )
    with independent_session(engine) as db:
        recurrence_service.stop_series(db, BOOTSTRAP_USER_ID, series_id)
    with pytest.raises(HTTPException) as exc:
        with independent_session(engine) as db:
            recurrence_service.resume_series(db, BOOTSTRAP_USER_ID, series_id)
    assert exc.value.status_code == 409
    with independent_session(engine) as db:
        series = db.get(TaskRecurrenceSeries, series_id)
        assert series is not None
        assert series.status == "stopped"
        assert _task_count(engine, series_id) == int(
            db.scalar(select(func.count()).select_from(Task).where(Task.recurrence_series_id == series_id)) or 0
        )


def test_archived_series_cannot_be_resumed(manage_board) -> None:
    engine, _board_id, column_id, _done_id, category_id = manage_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Archived series")
    _set_status(engine, series_id, "archived")
    with pytest.raises(HTTPException) as exc:
        with independent_session(engine) as db:
            recurrence_service.resume_series(db, BOOTSTRAP_USER_ID, series_id)
    assert exc.value.status_code == 409
    with independent_session(engine) as db:
        series = db.get(TaskRecurrenceSeries, series_id)
        assert series is not None
        assert series.status == "archived"


def test_other_user_receives_404(manage_board) -> None:
    engine, _board_id, column_id, _done_id, category_id = manage_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Owner only")
    other_id = None
    try:
        with independent_session(engine) as db:
            other = User(
                email=f"manage-404-{uuid4().hex[:8]}@example.com",
                display_name="Other",
                password_hash="x",
                timezone="UTC",
            )
            db.add(other)
            db.commit()
            db.refresh(other)
            other_id = other.id
        for action in (
            lambda db: recurrence_service.read_series(db, other_id, series_id),
            lambda db: recurrence_service.stop_series(db, other_id, series_id),
            lambda db: recurrence_service.resume_series(db, other_id, series_id),
        ):
            with independent_session(engine) as db:
                with pytest.raises(HTTPException) as exc:
                    action(db)
                assert exc.value.status_code == 404
    finally:
        if other_id is not None:
            with independent_session(engine) as db:
                row = db.get(User, other_id)
                if row is not None:
                    db.delete(row)
                    db.commit()


def test_stop_is_idempotent_and_keeps_history(manage_board) -> None:
    engine, _board_id, column_id, done_id, category_id = manage_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Stop twice")
    first = _occurrence(engine, series_id, FRIDAY)
    second = _occurrence(engine, series_id, NEXT_FRIDAY)
    with independent_session(engine) as db:
        task_ordering_service.move_task(
            db,
            BOOTSTRAP_USER_ID,
            first.id,
            TaskMove(target_column_id=done_id, expected_version=first.version, target_position=0),
        )
        task_service.update_task(
            db,
            BOOTSTRAP_USER_ID,
            second.id,
            TaskUpdate(title="Custom kept", edit_scope="this"),
        )
        task_service.delete_task(
            db, BOOTSTRAP_USER_ID, _occurrence(engine, series_id, THIRD_FRIDAY).id, delete_scope="this"
        )
    before_count = _task_count(engine, series_id)
    before_exceptions = _exception_dates(engine, series_id)
    with independent_session(engine) as db:
        first_stop = recurrence_service.stop_series(db, BOOTSTRAP_USER_ID, series_id)
        series = db.get(TaskRecurrenceSeries, series_id)
        assert series is not None
        version_after_first = series.version
    with independent_session(engine) as db:
        second_stop = recurrence_service.stop_series(db, BOOTSTRAP_USER_ID, series_id)
        series = db.get(TaskRecurrenceSeries, series_id)
        assert series is not None
        assert series.version == version_after_first
    assert first_stop.status == "stopped"
    assert second_stop.status == "stopped"
    assert _task_count(engine, series_id) == before_count
    assert _exception_dates(engine, series_id) == before_exceptions
    with independent_session(engine) as db:
        completed = db.get(Task, first.id)
        detached = db.get(Task, second.id)
        assert completed is not None and completed.completed_at is not None
        assert detached is not None and detached.is_detached is True


def test_list_does_not_generate_or_mutate_tasks(manage_board) -> None:
    engine, board_id, column_id, _done_id, category_id = manage_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Read only")
    with independent_session(engine) as db:
        series = db.get(TaskRecurrenceSeries, series_id)
        assert series is not None
        before_through = series.generated_through
        before_version = series.version
        before_updated = series.updated_at
        before_ids = set(db.scalars(select(Task.id).where(Task.recurrence_series_id == series_id)).all())
    _list(engine, board_id=board_id)
    with independent_session(engine) as db:
        series = db.get(TaskRecurrenceSeries, series_id)
        assert series is not None
        after_ids = set(db.scalars(select(Task.id).where(Task.recurrence_series_id == series_id)).all())
        assert after_ids == before_ids
        assert series.generated_through == before_through
        assert series.version == before_version
        assert series.updated_at == before_updated
        assert series.status == "active"
