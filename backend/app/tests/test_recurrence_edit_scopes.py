from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import date, timedelta
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.constants import BOOTSTRAP_USER_ID
from app.models import Board, BoardColumn, Category, Task, User
from app.models.task_recurrence import TaskRecurrenceSeries
from app.schemas.board import BoardCreate
from app.schemas.recurrence import RecurrenceInput
from app.schemas.task import Priority, TaskCreate, TaskLinkInput, TaskMove, TaskUpdate
from app.services import board_service, recurrence_service, task_ordering_service, task_service

FRIDAY = date(2026, 8, 21)
NEXT_FRIDAY = date(2026, 8, 28)
THIRD_FRIDAY = date(2026, 9, 4)
MONDAY = date(2026, 8, 31)
CONTENT_V1 = {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "v1"}]}]}
CONTENT_V2 = {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "v2"}]}]}


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
def edit_board(test_engine: Engine) -> Iterator[tuple[Engine, UUID, UUID, UUID, UUID]]:
    with independent_session(test_engine) as db:
        created = board_service.create_board(
            db,
            BOOTSTRAP_USER_ID,
            BoardCreate(name=f"Recur edit {uuid4().hex[:8]}"),
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
    due: date | None = None,
    recurrence: RecurrenceInput | None = None,
    content: dict | None = None,
    links: list[TaskLinkInput] | None = None,
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
                due_date=due or start,
                priority=Priority.medium,
                content=content,
                links=links or [],
                recurrence=recurrence
                or RecurrenceInput(freq="weekly", interval=1, weekdays=[4]),
            ),
        )
        assert created.recurrence is not None
        return created.recurrence.series_id


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


def _dates(engine: Engine, series_id: UUID) -> set[date]:
    with independent_session(engine) as db:
        return {
            item.original_occurrence_date
            for item in db.scalars(select(Task).where(Task.recurrence_series_id == series_id)).all()
            if item.original_occurrence_date is not None
        }


def _patch(engine: Engine, task_id: UUID, payload: TaskUpdate):
    with independent_session(engine) as db:
        return task_service.update_task(db, BOOTSTRAP_USER_ID, task_id, payload)


def _complete(engine: Engine, task_id: UUID, done_id: UUID, version: int) -> None:
    with independent_session(engine) as db:
        task_ordering_service.move_task(
            db,
            BOOTSTRAP_USER_ID,
            task_id,
            TaskMove(target_column_id=done_id, expected_version=version, target_position=0),
        )


def test_this_updates_only_one_occurrence_and_detaches(edit_board) -> None:
    engine, _board_id, column_id, _done_id, category_id = edit_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Weekly")
    selected = _occurrence(engine, series_id, NEXT_FRIDAY)
    sibling = _occurrence(engine, series_id, THIRD_FRIDAY)
    result = _patch(
        engine,
        selected.id,
        TaskUpdate(
            title="Only this",
            start_date=date(2026, 8, 29),
            due_date=date(2026, 8, 30),
            priority=Priority.high,
            content=CONTENT_V2,
            links=[TaskLinkInput(label="Docs", url="https://example.com/docs", position=0)],
            edit_scope="this",
        ),
    )
    assert result.id == selected.id
    with independent_session(engine) as db:
        updated = db.get(Task, selected.id)
        other = db.get(Task, sibling.id)
        series = db.get(TaskRecurrenceSeries, series_id)
        assert updated is not None and other is not None and series is not None
        assert updated.title == "Only this"
        assert updated.is_detached is True
        assert updated.original_occurrence_date == NEXT_FRIDAY
        assert updated.start_date == date(2026, 8, 29)
        assert updated.due_date == date(2026, 8, 30)
        assert updated.priority == "high"
        assert other.title == "Weekly"
        assert other.is_detached is False
        assert other.start_date == THIRD_FRIDAY
        assert series.title == "Weekly"
        assert series.freq == "weekly"
        assert series.weekdays == [4]


def test_this_rejects_recurrence_rule_change(edit_board) -> None:
    engine, _board_id, column_id, _done_id, category_id = edit_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Weekly")
    selected = _occurrence(engine, series_id, NEXT_FRIDAY)
    with pytest.raises(HTTPException) as exc:
        _patch(
            engine,
            selected.id,
            TaskUpdate(
                edit_scope="this",
                recurrence=RecurrenceInput(freq="weekly", interval=1, weekdays=[0]),
            ),
        )
    assert exc.value.status_code == 409
    with independent_session(engine) as db:
        series = db.get(TaskRecurrenceSeries, series_id)
        task = db.get(Task, selected.id)
        assert series is not None and task is not None
        assert series.weekdays == [4]
        assert task.is_detached is False


def test_this_does_not_regenerate_original_occurrence(edit_board) -> None:
    engine, _board_id, column_id, _done_id, category_id = edit_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Weekly")
    selected = _occurrence(engine, series_id, NEXT_FRIDAY)
    _patch(
        engine,
        selected.id,
        TaskUpdate(title="Moved", start_date=date(2026, 8, 29), due_date=date(2026, 8, 29), edit_scope="this"),
    )
    with independent_session(engine) as db:
        recurrence_service.generate_for_request(
            db, BOOTSTRAP_USER_ID, series_id, FRIDAY, FRIDAY + timedelta(days=62)
        )
    matching = [
        original
        for original in _dates(engine, series_id)
        if original == NEXT_FRIDAY
    ]
    assert matching == [NEXT_FRIDAY]
    with independent_session(engine) as db:
        rows = list(
            db.scalars(
                select(Task).where(
                    Task.recurrence_series_id == series_id,
                    Task.original_occurrence_date == NEXT_FRIDAY,
                )
            ).all()
        )
        assert len(rows) == 1
        assert rows[0].id == selected.id
        assert rows[0].is_detached is True


def test_this_and_future_template_edit_skips_earlier_completed_and_open(edit_board) -> None:
    engine, _board_id, column_id, done_id, category_id = edit_board
    series_id = _create_series(
        engine,
        column_id=column_id,
        category_id=category_id,
        title="Weekly",
        content=CONTENT_V1,
        links=[TaskLinkInput(label="Old", url="https://example.com/old", position=0)],
    )
    first = _occurrence(engine, series_id, FRIDAY)
    selected = _occurrence(engine, series_id, NEXT_FRIDAY)
    later = _occurrence(engine, series_id, THIRD_FRIDAY)
    _complete(engine, first.id, done_id, first.version)
    _patch(
        engine,
        selected.id,
        TaskUpdate(title="Kept history", start_date=date(2026, 8, 27), due_date=date(2026, 8, 27), edit_scope="this"),
    )
    following = _occurrence(engine, series_id, THIRD_FRIDAY)
    _patch(
        engine,
        following.id,
        TaskUpdate(
            title="New template",
            priority=Priority.high,
            content=CONTENT_V2,
            links=[TaskLinkInput(label="New", url="https://example.com/new", position=0)],
            edit_scope="this_and_future",
        ),
    )
    with independent_session(engine) as db:
        completed = db.get(Task, first.id)
        kept_detached = db.get(Task, selected.id)
        updated = db.get(Task, later.id)
        series = db.get(TaskRecurrenceSeries, series_id)
        assert completed is not None and kept_detached is not None and updated is not None and series is not None
        assert completed.title == "Weekly"
        assert completed.completed_at is not None
        assert kept_detached.title == "Kept history"
        assert kept_detached.is_detached is True
        assert updated.title == "New template"
        assert updated.priority == "high"
        assert updated.is_detached is False
        assert series.title == "New template"
        assert series.priority == "high"
        assert updated.id == later.id


def test_this_and_future_rule_change_starts_from_edited_start_date(edit_board) -> None:
    """New series dtstart is the edited start_date; old series ends the day before the original occurrence."""
    engine, _board_id, column_id, done_id, category_id = edit_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Friday standup")
    first = _occurrence(engine, series_id, FRIDAY)
    selected = _occurrence(engine, series_id, NEXT_FRIDAY)
    later = _occurrence(engine, series_id, THIRD_FRIDAY)
    _complete(engine, first.id, done_id, first.version)
    result = _patch(
        engine,
        selected.id,
        TaskUpdate(
            title="Monday standup",
            start_date=MONDAY,
            due_date=MONDAY,
            edit_scope="this_and_future",
            recurrence=RecurrenceInput(freq="weekly", interval=1, weekdays=[0]),
        ),
    )
    assert result.id == selected.id
    with independent_session(engine) as db:
        old_series = db.get(TaskRecurrenceSeries, series_id)
        selected_row = db.get(Task, selected.id)
        later_row = db.get(Task, later.id)
        first_row = db.get(Task, first.id)
        assert old_series is not None and selected_row is not None and first_row is not None
        assert old_series.until_date == date(2026, 8, 27)
        assert old_series.weekdays == [4]
        assert first_row.recurrence_series_id == series_id
        assert first_row.completed_at is not None
        assert first_row.original_occurrence_date == FRIDAY
        assert later_row is None
        assert selected_row.recurrence_series_id != series_id
        new_series = db.get(TaskRecurrenceSeries, selected_row.recurrence_series_id)
        assert new_series is not None
        assert new_series.dtstart == MONDAY
        assert new_series.weekdays == [0]
        assert new_series.title == "Monday standup"
        new_dates = {
            item.original_occurrence_date
            for item in db.scalars(select(Task).where(Task.recurrence_series_id == new_series.id)).all()
        }
        assert MONDAY in new_dates
        assert NEXT_FRIDAY not in new_dates
        assert THIRD_FRIDAY not in new_dates
        assert all(item is not None and item.weekday() == 0 for item in new_dates)


def test_this_and_future_rule_change_keeps_detached_occurrence(edit_board) -> None:
    engine, _board_id, column_id, _done_id, category_id = edit_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Friday")
    selected = _occurrence(engine, series_id, NEXT_FRIDAY)
    later = _occurrence(engine, series_id, THIRD_FRIDAY)
    _patch(engine, later.id, TaskUpdate(title="Detached later", edit_scope="this"))
    _patch(
        engine,
        selected.id,
        TaskUpdate(
            start_date=MONDAY,
            due_date=MONDAY,
            edit_scope="this_and_future",
            recurrence=RecurrenceInput(freq="weekly", interval=1, weekdays=[0]),
        ),
    )
    with independent_session(engine) as db:
        detached = db.get(Task, later.id)
        assert detached is not None
        assert detached.is_detached is True
        assert detached.title == "Detached later"
        assert detached.original_occurrence_date == THIRD_FRIDAY
        assert detached.recurrence_series_id == series_id


def test_series_template_edit_updates_open_attached_only(edit_board) -> None:
    engine, _board_id, column_id, done_id, category_id = edit_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Weekly")
    first = _occurrence(engine, series_id, FRIDAY)
    selected = _occurrence(engine, series_id, NEXT_FRIDAY)
    later = _occurrence(engine, series_id, THIRD_FRIDAY)
    _complete(engine, first.id, done_id, first.version)
    _patch(engine, later.id, TaskUpdate(title="Detached", edit_scope="this"))
    _patch(
        engine,
        selected.id,
        TaskUpdate(title="Series title", priority=Priority.low, content=CONTENT_V2, edit_scope="series"),
    )
    with independent_session(engine) as db:
        completed = db.get(Task, first.id)
        attached = db.get(Task, selected.id)
        detached = db.get(Task, later.id)
        series = db.get(TaskRecurrenceSeries, series_id)
        assert completed is not None and attached is not None and detached is not None and series is not None
        assert completed.title == "Weekly"
        assert completed.original_occurrence_date == FRIDAY
        assert detached.title == "Detached"
        assert attached.title == "Series title"
        assert attached.priority == "low"
        assert attached.original_occurrence_date == NEXT_FRIDAY
        assert series.title == "Series title"
        assert series.freq == "weekly"
        assert series.weekdays == [4]


def test_series_rule_change_removes_obsolete_open_dates(edit_board) -> None:
    engine, _board_id, column_id, done_id, category_id = edit_board
    series_id = _create_series(
        engine,
        column_id=column_id,
        category_id=category_id,
        title="Daily",
        recurrence=RecurrenceInput(freq="daily", interval=1),
    )
    first = _occurrence(engine, series_id, FRIDAY)
    saturday = _occurrence(engine, series_id, date(2026, 8, 22))
    selected = _occurrence(engine, series_id, NEXT_FRIDAY)
    _complete(engine, first.id, done_id, first.version)
    _patch(
        engine,
        selected.id,
        TaskUpdate(
            edit_scope="series",
            recurrence=RecurrenceInput(freq="weekly", interval=1, weekdays=[4]),
        ),
    )
    with independent_session(engine) as db:
        completed = db.get(Task, first.id)
        gone = db.get(Task, saturday.id)
        kept = db.get(Task, selected.id)
        series = db.get(TaskRecurrenceSeries, series_id)
        assert completed is not None and series is not None
        assert completed.title == "Daily"
        assert completed.original_occurrence_date == FRIDAY
        assert gone is None
        assert kept is not None
        assert kept.original_occurrence_date == NEXT_FRIDAY
        assert series.freq == "weekly"
        assert series.weekdays == [4]
        assert series.dtstart == FRIDAY
        dates = {
            item.original_occurrence_date
            for item in db.scalars(select(Task).where(Task.recurrence_series_id == series_id)).all()
            if item.completed_at is None and item.is_detached is False
        }
        assert date(2026, 8, 22) not in dates
        assert all(item is not None and item.weekday() == 4 for item in dates)


def test_repeated_generation_after_rule_edit_is_idempotent(edit_board) -> None:
    engine, _board_id, column_id, _done_id, category_id = edit_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Friday")
    selected = _occurrence(engine, series_id, NEXT_FRIDAY)
    result = _patch(
        engine,
        selected.id,
        TaskUpdate(
            start_date=MONDAY,
            due_date=MONDAY,
            edit_scope="this_and_future",
            recurrence=RecurrenceInput(freq="weekly", interval=1, weekdays=[0]),
        ),
    )
    new_series_id = result.recurrence.series_id if result.recurrence else None
    assert new_series_id is not None
    with independent_session(engine) as db:
        first = recurrence_service.generate_for_request(
            db, BOOTSTRAP_USER_ID, new_series_id, MONDAY, date(2026, 10, 5)
        )
        assert first.created >= 0
    with independent_session(engine) as db:
        second = recurrence_service.generate_for_request(
            db, BOOTSTRAP_USER_ID, new_series_id, MONDAY, date(2026, 10, 5)
        )
        assert second.created == 0
        rows = list(db.scalars(select(Task).where(Task.recurrence_series_id == new_series_id)).all())
        originals = [item.original_occurrence_date for item in rows]
        assert len(originals) == len(set(originals))


def test_other_user_cannot_edit_any_scope(edit_board) -> None:
    engine, _board_id, column_id, _done_id, category_id = edit_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Private")
    selected = _occurrence(engine, series_id, NEXT_FRIDAY)
    other_id = None
    try:
        with independent_session(engine) as db:
            other = User(
                email=f"edit-other-{uuid4().hex[:8]}@example.com",
                display_name="Other",
                password_hash="x",
                timezone="UTC",
            )
            db.add(other)
            db.commit()
            db.refresh(other)
            other_id = other.id
        for scope in ("this", "this_and_future", "series"):
            with independent_session(engine) as db:
                with pytest.raises(HTTPException) as exc:
                    task_service.update_task(
                        db,
                        other_id,
                        selected.id,
                        TaskUpdate(title="Stolen", edit_scope=scope),  # type: ignore[arg-type]
                    )
                assert exc.value.status_code == 404
        with independent_session(engine) as db:
            task = db.get(Task, selected.id)
            assert task is not None
            assert task.title == "Private"
    finally:
        if other_id is not None:
            with independent_session(engine) as db:
                row = db.get(User, other_id)
                if row is not None:
                    db.delete(row)
                    db.commit()


def test_category_change_cannot_cross_board(edit_board) -> None:
    engine, board_id, column_id, _done_id, category_id = edit_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Weekly")
    selected = _occurrence(engine, series_id, NEXT_FRIDAY)
    with independent_session(engine) as db:
        other_board = board_service.create_board(
            db,
            BOOTSTRAP_USER_ID,
            BoardCreate(name=f"Recur edit other {uuid4().hex[:8]}"),
        )
        db.commit()
        other_id = other_board.id
        other_category = db.scalar(select(Category).where(Category.board_id == other_id))
        assert other_category is not None
        other_category_id = other_category.id
    try:
        with pytest.raises(HTTPException) as exc:
            _patch(
                engine,
                selected.id,
                TaskUpdate(category_id=other_category_id, edit_scope="this_and_future"),
            )
        assert exc.value.status_code == 422
        with independent_session(engine) as db:
            task = db.get(Task, selected.id)
            assert task is not None
            assert task.category_id == category_id
    finally:
        _delete_board(engine, other_id)


def test_duration_and_template_propagate_to_future_generated(edit_board) -> None:
    engine, _board_id, column_id, _done_id, category_id = edit_board
    series_id = _create_series(
        engine,
        column_id=column_id,
        category_id=category_id,
        title="Weekly",
        start=FRIDAY,
        due=date(2026, 8, 22),
        links=[TaskLinkInput(label="Old", url="https://example.com/old", position=0)],
    )
    selected = _occurrence(engine, series_id, NEXT_FRIDAY)
    later = _occurrence(engine, series_id, THIRD_FRIDAY)
    _patch(
        engine,
        selected.id,
        TaskUpdate(
            title="Two-day",
            start_date=NEXT_FRIDAY,
            due_date=date(2026, 8, 30),
            priority=Priority.high,
            content=CONTENT_V2,
            links=[TaskLinkInput(label="New", url="https://example.com/new", position=0)],
            edit_scope="this_and_future",
        ),
    )
    with independent_session(engine) as db:
        series = db.get(TaskRecurrenceSeries, series_id)
        selected_row = db.get(Task, selected.id)
        later_row = db.get(Task, later.id)
        assert series is not None and selected_row is not None and later_row is not None
        assert series.duration_days == 2
        assert selected_row.start_date == NEXT_FRIDAY
        assert selected_row.due_date == date(2026, 8, 30)
        assert later_row.start_date == THIRD_FRIDAY
        assert later_row.due_date == date(2026, 9, 6)
        assert later_row.title == "Two-day"
        assert later_row.priority == "high"
        assert [link.url for link in later_row.links] == ["https://example.com/new"]
        db.expire(series)
    future = date(2026, 10, 23)
    with independent_session(engine) as db:
        board_service.get_board_view(
            db,
            BOOTSTRAP_USER_ID,
            _board_id,
            start_date=future,
            end_date=future,
        )
    generated = _occurrence(engine, series_id, future)
    assert generated.title == "Two-day"
    assert generated.priority == "high"
    assert generated.start_date == future
    assert generated.due_date == date(2026, 10, 25)
    assert generated.id != selected.id


def _weekly_rule(*, weekday: int = 4) -> RecurrenceInput:
    """Match TaskForm `buildRecurrenceInput` for Repeat: Weekly."""
    return RecurrenceInput(freq="weekly", interval=1, weekdays=[weekday])


def _form_payload(
    *,
    title: str,
    start: date,
    due: date,
    category_id: UUID,
    edit_scope: str,
    recurrence: RecurrenceInput | None,
    priority: Priority = Priority.medium,
    content: dict | None = None,
    links: list[TaskLinkInput] | None = None,
) -> TaskUpdate:
    """Reproduce the full PATCH body TaskForm always sends on save."""
    return TaskUpdate(
        title=title,
        description=None,
        content=content,
        start_date=start,
        due_date=due,
        priority=priority,
        category_id=category_id,
        links=links or [],
        edit_scope=edit_scope,  # type: ignore[arg-type]
        recurrence=recurrence,
    )


def _attached_dates(engine: Engine, series_id: UUID) -> dict[UUID, tuple[date, date, date]]:
    with independent_session(engine) as db:
        rows = list(
            db.scalars(
                select(Task).where(
                    Task.recurrence_series_id == series_id,
                    Task.is_detached.is_(False),
                    Task.completed_at.is_(None),
                )
            ).all()
        )
        return {
            item.id: (item.original_occurrence_date, item.occurrence_date, item.start_date)
            for item in rows
            if item.original_occurrence_date and item.occurrence_date
        }


def _series_ids_on_board(engine: Engine, board_id: UUID) -> set[UUID]:
    with independent_session(engine) as db:
        return set(db.scalars(select(TaskRecurrenceSeries.id).where(TaskRecurrenceSeries.board_id == board_id)).all())


def test_form_payload_title_only_this_and_future_does_not_split(edit_board) -> None:
    engine, board_id, column_id, _done_id, category_id = edit_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Weekly")
    first = _occurrence(engine, series_id, FRIDAY)
    selected = _occurrence(engine, series_id, NEXT_FRIDAY)
    later = _occurrence(engine, series_id, THIRD_FRIDAY)
    before_ids = {first.id, selected.id, later.id}
    before_series = _series_ids_on_board(engine, board_id)

    _patch(
        engine,
        selected.id,
        _form_payload(
            title="Renamed",
            start=selected.start_date,
            due=selected.due_date,
            category_id=category_id,
            edit_scope="this_and_future",
            recurrence=_weekly_rule(weekday=4),
        ),
    )

    after_series = _series_ids_on_board(engine, board_id)
    assert after_series == before_series
    with independent_session(engine) as db:
        assert db.get(Task, first.id) is not None
        assert db.get(Task, selected.id) is not None
        assert db.get(Task, later.id) is not None
        assert {first.id, selected.id, later.id} == before_ids
        first_row = db.get(Task, first.id)
        selected_row = db.get(Task, selected.id)
        later_row = db.get(Task, later.id)
        series = db.get(TaskRecurrenceSeries, series_id)
        assert first_row is not None and selected_row is not None and later_row is not None and series is not None
        assert first_row.title == "Weekly"
        assert selected_row.title == "Renamed"
        assert later_row.title == "Renamed"
        assert selected_row.recurrence_series_id == series_id
        assert later_row.recurrence_series_id == series_id
        assert series.freq == "weekly"
        assert series.weekdays == [4]
        assert series.dtstart == FRIDAY
        assert selected_row.original_occurrence_date == selected_row.occurrence_date == selected_row.start_date == NEXT_FRIDAY


def test_form_payload_title_only_series_does_not_purge_or_remap(edit_board) -> None:
    engine, _board_id, column_id, _done_id, category_id = edit_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Weekly")
    selected = _occurrence(engine, series_id, NEXT_FRIDAY)
    before = _attached_dates(engine, series_id)
    _patch(
        engine,
        selected.id,
        _form_payload(
            title="Series rename",
            start=selected.start_date,
            due=selected.due_date,
            category_id=category_id,
            edit_scope="series",
            recurrence=_weekly_rule(weekday=4),
        ),
    )
    after = _attached_dates(engine, series_id)
    assert after.keys() == before.keys()
    assert after == before
    with independent_session(engine) as db:
        series = db.get(TaskRecurrenceSeries, series_id)
        selected_row = db.get(Task, selected.id)
        assert series is not None and selected_row is not None
        assert series.title == "Series rename"
        assert selected_row.title == "Series rename"
        assert selected_row.original_occurrence_date == NEXT_FRIDAY
        assert selected_row.start_date == NEXT_FRIDAY
        assert selected_row.occurrence_date == NEXT_FRIDAY


def test_form_payload_series_friday_to_monday_keeps_history_and_aligns_dates(edit_board) -> None:
    engine, _board_id, column_id, done_id, category_id = edit_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Friday")
    first = _occurrence(engine, series_id, FRIDAY)
    selected = _occurrence(engine, series_id, NEXT_FRIDAY)
    later = _occurrence(engine, series_id, THIRD_FRIDAY)
    _complete(engine, first.id, done_id, first.version)
    _patch(
        engine,
        selected.id,
        _form_payload(
            title="Friday",
            start=MONDAY,
            due=MONDAY,
            category_id=category_id,
            edit_scope="series",
            recurrence=_weekly_rule(weekday=0),
        ),
    )
    with independent_session(engine) as db:
        completed = db.get(Task, first.id)
        selected_row = db.get(Task, selected.id)
        later_row = db.get(Task, later.id)
        series = db.get(TaskRecurrenceSeries, series_id)
        assert completed is not None and selected_row is not None and series is not None
        assert later_row is None
        assert completed.completed_at is not None
        assert completed.original_occurrence_date == FRIDAY
        assert completed.start_date == FRIDAY
        assert completed.recurrence_series_id == series_id
        assert series.freq == "weekly"
        assert series.weekdays == [0]
        assert series.dtstart == FRIDAY
        open_rows = list(
            db.scalars(
                select(Task).where(
                    Task.recurrence_series_id == series_id,
                    Task.completed_at.is_(None),
                    Task.is_detached.is_(False),
                )
            ).all()
        )
        assert open_rows
        for item in open_rows:
            assert item.original_occurrence_date == item.occurrence_date == item.start_date
            assert item.original_occurrence_date is not None
            assert item.original_occurrence_date.weekday() == 0
        assert selected_row.original_occurrence_date == selected_row.start_date
        assert selected_row.original_occurrence_date is not None
        assert selected_row.original_occurrence_date.weekday() == 0


def test_form_payload_this_and_future_friday_to_monday_splits_once(edit_board) -> None:
    engine, board_id, column_id, done_id, category_id = edit_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Friday")
    first = _occurrence(engine, series_id, FRIDAY)
    selected = _occurrence(engine, series_id, NEXT_FRIDAY)
    later = _occurrence(engine, series_id, THIRD_FRIDAY)
    _complete(engine, first.id, done_id, first.version)
    result = _patch(
        engine,
        selected.id,
        _form_payload(
            title="Monday",
            start=MONDAY,
            due=MONDAY,
            category_id=category_id,
            edit_scope="this_and_future",
            recurrence=_weekly_rule(weekday=0),
        ),
    )
    assert result.recurrence is not None
    new_series_id = result.recurrence.series_id
    assert new_series_id != series_id
    with independent_session(engine) as db:
        old_series = db.get(TaskRecurrenceSeries, series_id)
        new_series = db.get(TaskRecurrenceSeries, new_series_id)
        selected_row = db.get(Task, selected.id)
        later_row = db.get(Task, later.id)
        first_row = db.get(Task, first.id)
        assert old_series is not None and new_series is not None and selected_row is not None and first_row is not None
        assert old_series.until_date == date(2026, 8, 27)
        assert new_series.dtstart == MONDAY
        assert new_series.weekdays == [0]
        assert later_row is None
        assert selected_row.recurrence_series_id == new_series_id
        assert first_row.recurrence_series_id == series_id
        new_dates = [
            item.original_occurrence_date
            for item in db.scalars(select(Task).where(Task.recurrence_series_id == new_series_id)).all()
        ]
        assert len(new_dates) == len(set(new_dates))
        assert all(item is not None and item.weekday() == 0 for item in new_dates)
        assert selected_row.original_occurrence_date == selected_row.occurrence_date == selected_row.start_date
    assert len(_series_ids_on_board(engine, board_id)) == 2


def test_far_future_occurrence_survives_unchanged_series_form_edit(edit_board) -> None:
    engine, _board_id, column_id, _done_id, category_id = edit_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Weekly")
    far = date(2028, 1, 7)
    assert far.weekday() == 4
    with independent_session(engine) as db:
        recurrence_service.generate_for_request(db, BOOTSTRAP_USER_ID, series_id, far, far)
    far_task = _occurrence(engine, series_id, far)
    selected = _occurrence(engine, series_id, NEXT_FRIDAY)
    _patch(
        engine,
        selected.id,
        _form_payload(
            title="Still weekly",
            start=selected.start_date,
            due=selected.due_date,
            category_id=category_id,
            edit_scope="series",
            recurrence=_weekly_rule(weekday=4),
        ),
    )
    with independent_session(engine) as db:
        persisted = db.get(Task, far_task.id)
        assert persisted is not None
        assert persisted.original_occurrence_date == far
        assert persisted.start_date == far
        assert persisted.occurrence_date == far
        assert persisted.title == "Still weekly"


def test_form_payload_generation_after_edit_is_idempotent(edit_board) -> None:
    engine, _board_id, column_id, _done_id, category_id = edit_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Weekly")
    selected = _occurrence(engine, series_id, NEXT_FRIDAY)
    _patch(
        engine,
        selected.id,
        _form_payload(
            title="Renamed",
            start=selected.start_date,
            due=selected.due_date,
            category_id=category_id,
            edit_scope="this_and_future",
            recurrence=_weekly_rule(weekday=4),
        ),
    )
    with independent_session(engine) as db:
        first = recurrence_service.generate_for_request(
            db, BOOTSTRAP_USER_ID, series_id, FRIDAY, date(2026, 10, 23)
        )
        assert first.created >= 0
    with independent_session(engine) as db:
        second = recurrence_service.generate_for_request(
            db, BOOTSTRAP_USER_ID, series_id, FRIDAY, date(2026, 10, 23)
        )
        assert second.created == 0
        rows = list(db.scalars(select(Task).where(Task.recurrence_series_id == series_id)).all())
        originals = [item.original_occurrence_date for item in rows]
        assert len(originals) == len(set(originals))


def test_form_payload_unchanged_this_does_not_detach(edit_board) -> None:
    engine, _board_id, column_id, _done_id, category_id = edit_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Weekly")
    selected = _occurrence(engine, series_id, NEXT_FRIDAY)
    _patch(
        engine,
        selected.id,
        _form_payload(
            title=selected.title,
            start=selected.start_date,
            due=selected.due_date,
            category_id=category_id,
            edit_scope="this",
            recurrence=_weekly_rule(weekday=4),
        ),
    )
    with independent_session(engine) as db:
        row = db.get(Task, selected.id)
        series = db.get(TaskRecurrenceSeries, series_id)
        assert row is not None and series is not None
        assert row.is_detached is False
        assert row.title == "Weekly"
        assert series.title == "Weekly"
        assert series.weekdays == [4]


def test_form_payload_title_change_this_does_detach(edit_board) -> None:
    engine, _board_id, column_id, _done_id, category_id = edit_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Weekly")
    selected = _occurrence(engine, series_id, NEXT_FRIDAY)
    _patch(
        engine,
        selected.id,
        _form_payload(
            title="Only this",
            start=selected.start_date,
            due=selected.due_date,
            category_id=category_id,
            edit_scope="this",
            recurrence=_weekly_rule(weekday=4),
        ),
    )
    with independent_session(engine) as db:
        row = db.get(Task, selected.id)
        series = db.get(TaskRecurrenceSeries, series_id)
        assert row is not None and series is not None
        assert row.is_detached is True
        assert row.title == "Only this"
        assert series.title == "Weekly"


def test_form_payload_cannot_cross_user_or_board(edit_board) -> None:
    engine, _board_id, column_id, _done_id, category_id = edit_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Private")
    selected = _occurrence(engine, series_id, NEXT_FRIDAY)
    other_id = None
    other_board_id = None
    try:
        with independent_session(engine) as db:
            other = User(
                email=f"form-other-{uuid4().hex[:8]}@example.com",
                display_name="Other",
                password_hash="x",
                timezone="UTC",
            )
            db.add(other)
            db.commit()
            db.refresh(other)
            other_id = other.id
            other_board = board_service.create_board(
                db, BOOTSTRAP_USER_ID, BoardCreate(name=f"Recur edit other {uuid4().hex[:8]}")
            )
            db.commit()
            other_board_id = other_board.id
            other_category = db.scalar(select(Category).where(Category.board_id == other_board_id))
            assert other_category is not None
            other_category_id = other_category.id
        payload = _form_payload(
            title="Stolen",
            start=selected.start_date,
            due=selected.due_date,
            category_id=category_id,
            edit_scope="series",
            recurrence=_weekly_rule(weekday=4),
        )
        with independent_session(engine) as db:
            with pytest.raises(HTTPException) as exc:
                task_service.update_task(db, other_id, selected.id, payload)
            assert exc.value.status_code == 404
        with pytest.raises(HTTPException) as exc:
            _patch(
                engine,
                selected.id,
                _form_payload(
                    title="Private",
                    start=selected.start_date,
                    due=selected.due_date,
                    category_id=other_category_id,
                    edit_scope="this_and_future",
                    recurrence=_weekly_rule(weekday=4),
                ),
            )
        assert exc.value.status_code == 422
        with independent_session(engine) as db:
            task = db.get(Task, selected.id)
            assert task is not None
            assert task.title == "Private"
            assert task.category_id == category_id
    finally:
        if other_board_id is not None:
            _delete_board(engine, other_board_id)
        if other_id is not None:
            with independent_session(engine) as db:
                row = db.get(User, other_id)
                if row is not None:
                    db.delete(row)
                    db.commit()


def _monthly_rule() -> RecurrenceInput:
    """Match TaskForm monthly preset: month_day is inferred from start_date."""
    return RecurrenceInput(freq="monthly", interval=1)


def _yearly_rule() -> RecurrenceInput:
    """Match TaskForm yearly preset: month and day are inferred from start_date."""
    return RecurrenceInput(freq="yearly", interval=1)


SEPTEMBER_15 = date(2026, 9, 15)
SEPTEMBER_21 = date(2026, 9, 21)
OCTOBER_15 = date(2026, 10, 15)
YEARLY_MONTH_ERROR = "Yearly month cannot be changed for the entire series"


def test_form_payload_explicit_null_stops_repeating(edit_board) -> None:
    engine, _board_id, column_id, _done_id, category_id = edit_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Weekly")
    selected = _occurrence(engine, series_id, NEXT_FRIDAY)
    before = _dates(engine, series_id)
    assert before
    _patch(
        engine,
        selected.id,
        _form_payload(
            title=selected.title,
            start=selected.start_date,
            due=selected.due_date,
            category_id=category_id,
            edit_scope="this",
            recurrence=None,
        ),
    )
    with independent_session(engine) as db:
        row = db.get(Task, selected.id)
        series = db.get(TaskRecurrenceSeries, series_id)
        assert row is not None and series is not None
        assert series.status == "stopped"
        assert row.is_detached is False
        assert row.recurrence_series_id == series_id
        assert row.title == "Weekly"
    assert _dates(engine, series_id) == before
    with independent_session(engine) as db:
        generated = recurrence_service.generate_for_request(
            db, BOOTSTRAP_USER_ID, series_id, FRIDAY, date(2026, 10, 23)
        )
        assert generated.created == 0


def test_form_payload_unchanged_monthly_is_not_a_rule_change(edit_board) -> None:
    engine, _board_id, column_id, _done_id, category_id = edit_board
    series_id = _create_series(
        engine,
        column_id=column_id,
        category_id=category_id,
        title="Monthly",
        start=FRIDAY,
        recurrence=_monthly_rule(),
    )
    selected = _occurrence(engine, series_id, SEPTEMBER_21)
    before = _dates(engine, series_id)
    _patch(
        engine,
        selected.id,
        _form_payload(
            title="Monthly",
            start=selected.start_date,
            due=selected.due_date,
            category_id=category_id,
            edit_scope="series",
            recurrence=_monthly_rule(),
        ),
    )
    with independent_session(engine) as db:
        row = db.get(Task, selected.id)
        series = db.get(TaskRecurrenceSeries, series_id)
        assert row is not None and series is not None
        assert series.freq == "monthly"
        assert series.month_day == 21
        assert series.dtstart == FRIDAY
        assert row.original_occurrence_date == SEPTEMBER_21
        assert row.start_date == SEPTEMBER_21
        assert row.is_detached is False
    assert _dates(engine, series_id) == before


def test_form_payload_monthly_day_change_is_detected(edit_board) -> None:
    engine, board_id, column_id, _done_id, category_id = edit_board
    series_id = _create_series(
        engine,
        column_id=column_id,
        category_id=category_id,
        title="Monthly",
        start=FRIDAY,
        recurrence=_monthly_rule(),
    )
    selected = _occurrence(engine, series_id, SEPTEMBER_21)
    _patch(
        engine,
        selected.id,
        _form_payload(
            title="Monthly",
            start=SEPTEMBER_15,
            due=SEPTEMBER_15,
            category_id=category_id,
            edit_scope="this_and_future",
            recurrence=_monthly_rule(),
        ),
    )
    with independent_session(engine) as db:
        old_series = db.get(TaskRecurrenceSeries, series_id)
        selected_row = db.get(Task, selected.id)
        assert old_series is not None and selected_row is not None
        assert old_series.until_date == date(2026, 9, 20)
        assert old_series.month_day == 21
        new_series = db.get(TaskRecurrenceSeries, selected_row.recurrence_series_id)
        assert new_series is not None
        assert new_series.id != series_id
        assert new_series.freq == "monthly"
        assert new_series.month_day == 15
        assert new_series.dtstart == OCTOBER_15
        assert selected_row.original_occurrence_date == OCTOBER_15
        assert selected_row.start_date == OCTOBER_15
        assert selected_row.is_detached is False
    assert len(_series_ids_on_board(engine, board_id)) == 2


def test_form_payload_unchanged_yearly_is_not_a_rule_change(edit_board) -> None:
    engine, _board_id, column_id, _done_id, category_id = edit_board
    series_id = _create_series(
        engine,
        column_id=column_id,
        category_id=category_id,
        title="Yearly",
        start=FRIDAY,
        recurrence=_yearly_rule(),
    )
    selected = _occurrence(engine, series_id, FRIDAY)
    before = _dates(engine, series_id)
    _patch(
        engine,
        selected.id,
        _form_payload(
            title="Yearly",
            start=selected.start_date,
            due=selected.due_date,
            category_id=category_id,
            edit_scope="series",
            recurrence=_yearly_rule(),
        ),
    )
    with independent_session(engine) as db:
        row = db.get(Task, selected.id)
        series = db.get(TaskRecurrenceSeries, series_id)
        assert row is not None and series is not None
        assert series.freq == "yearly"
        assert series.month_day == 21
        assert series.dtstart == FRIDAY
        assert series.dtstart.month == 8
        assert row.original_occurrence_date == FRIDAY
        assert row.is_detached is False
    assert _dates(engine, series_id) == before


def test_form_payload_yearly_month_change_series_returns_validation_error(edit_board) -> None:
    engine, _board_id, column_id, _done_id, category_id = edit_board
    series_id = _create_series(
        engine,
        column_id=column_id,
        category_id=category_id,
        title="Yearly",
        start=FRIDAY,
        recurrence=_yearly_rule(),
    )
    selected = _occurrence(engine, series_id, FRIDAY)
    with pytest.raises(HTTPException) as exc:
        _patch(
            engine,
            selected.id,
            _form_payload(
                title="Yearly",
                start=SEPTEMBER_15,
                due=SEPTEMBER_15,
                category_id=category_id,
                edit_scope="series",
                recurrence=_yearly_rule(),
            ),
        )
    assert exc.value.status_code == 422
    assert YEARLY_MONTH_ERROR in str(exc.value.detail)
    with independent_session(engine) as db:
        series = db.get(TaskRecurrenceSeries, series_id)
        row = db.get(Task, selected.id)
        assert series is not None and row is not None
        assert series.dtstart == FRIDAY
        assert series.month_day == 21
        assert row.original_occurrence_date == FRIDAY
