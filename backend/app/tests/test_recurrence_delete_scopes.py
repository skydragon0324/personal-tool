from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import date
from pathlib import Path
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.constants import BOOTSTRAP_USER_ID
from app.models import Board, BoardColumn, Category, Task, TaskAttachment, User
from app.models.task_recurrence import TaskRecurrenceException, TaskRecurrenceSeries
from app.schemas.board import BoardCreate
from app.schemas.recurrence import RecurrenceInput
from app.schemas.task import Priority, TaskCreate, TaskMove, TaskUpdate
from app.services import board_service, recurrence_service, task_ordering_service, task_service, today_service
from app.services.storage import get_storage

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
def delete_board(test_engine: Engine) -> Iterator[tuple[Engine, UUID, UUID, UUID, UUID]]:
    with independent_session(test_engine) as db:
        created = board_service.create_board(
            db,
            BOOTSTRAP_USER_ID,
            BoardCreate(name=f"Recur delete {uuid4().hex[:8]}"),
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
    title: str = "Weekly",
) -> UUID:
    with independent_session(engine) as db:
        created = recurrence_service.create_recurring_task(
            db,
            BOOTSTRAP_USER_ID,
            TaskCreate(
                column_id=column_id,
                category_id=category_id,
                title=title,
                start_date=FRIDAY,
                due_date=FRIDAY,
                priority=Priority.medium,
                recurrence=RecurrenceInput(freq="weekly", interval=1, weekdays=[4]),
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


def _delete(
    engine: Engine,
    task_id: UUID,
    *,
    delete_scope: str,
    confirm_completed: bool = False,
) -> None:
    with independent_session(engine) as db:
        task_service.delete_task(
            db,
            BOOTSTRAP_USER_ID,
            task_id,
            delete_scope=delete_scope,
            confirm_completed=confirm_completed,
        )


def _complete(engine: Engine, task_id: UUID, done_id: UUID, version: int) -> None:
    with independent_session(engine) as db:
        task_ordering_service.move_task(
            db,
            BOOTSTRAP_USER_ID,
            task_id,
            TaskMove(target_column_id=done_id, expected_version=version, target_position=0),
        )


def _detach(engine: Engine, task_id: UUID, title: str) -> None:
    with independent_session(engine) as db:
        task_service.update_task(
            db,
            BOOTSTRAP_USER_ID,
            task_id,
            TaskUpdate(title=title, edit_scope="this"),
        )


def _exception_dates(engine: Engine, series_id: UUID) -> set[date]:
    with independent_session(engine) as db:
        return set(
            db.scalars(
                select(TaskRecurrenceException.original_occurrence_date).where(
                    TaskRecurrenceException.series_id == series_id
                )
            ).all()
        )


def _task_ids(engine: Engine, series_id: UUID) -> set[UUID]:
    with independent_session(engine) as db:
        return set(db.scalars(select(Task.id).where(Task.recurrence_series_id == series_id)).all())


def _assert_contiguous_positions(engine: Engine, column_id: UUID) -> None:
    with independent_session(engine) as db:
        rows = list(
            db.scalars(select(Task).where(Task.column_id == column_id).order_by(Task.position, Task.id)).all()
        )
        assert [item.position for item in rows] == list(range(len(rows)))


def test_delete_one_open_occurrence(delete_board) -> None:
    engine, _board_id, column_id, _done_id, category_id = delete_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id)
    selected = _occurrence(engine, series_id, NEXT_FRIDAY)
    sibling = _occurrence(engine, series_id, THIRD_FRIDAY)
    first = _occurrence(engine, series_id, FRIDAY)
    _delete(engine, selected.id, delete_scope="this")
    with independent_session(engine) as db:
        series = db.get(TaskRecurrenceSeries, series_id)
        assert series is not None
        assert series.status == "active"
        assert series.freq == "weekly"
        assert db.get(Task, selected.id) is None
        assert db.get(Task, sibling.id) is not None
        assert db.get(Task, first.id) is not None
    assert NEXT_FRIDAY in _exception_dates(engine, series_id)


def test_deleted_open_occurrence_is_not_regenerated(delete_board) -> None:
    engine, _board_id, column_id, _done_id, category_id = delete_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id)
    selected = _occurrence(engine, series_id, NEXT_FRIDAY)
    sibling = _occurrence(engine, series_id, THIRD_FRIDAY)
    _delete(engine, selected.id, delete_scope="this")
    with independent_session(engine) as db:
        recurrence_service.generate_for_request(
            db, BOOTSTRAP_USER_ID, series_id, FRIDAY, date(2026, 10, 23)
        )
        assert db.get(Task, sibling.id) is not None
        assert (
            db.scalar(
                select(Task).where(
                    Task.recurrence_series_id == series_id,
                    Task.original_occurrence_date == NEXT_FRIDAY,
                )
            )
            is None
        )


def test_completed_occurrence_requires_confirmation(delete_board) -> None:
    engine, _board_id, column_id, done_id, category_id = delete_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id)
    selected = _occurrence(engine, series_id, NEXT_FRIDAY)
    _complete(engine, selected.id, done_id, selected.version)
    with pytest.raises(HTTPException) as exc:
        _delete(engine, selected.id, delete_scope="this")
    assert exc.value.status_code == 409
    with independent_session(engine) as db:
        assert db.get(Task, selected.id) is not None
    assert NEXT_FRIDAY not in _exception_dates(engine, series_id)


def test_confirmed_completed_occurrence_is_not_regenerated(delete_board) -> None:
    engine, _board_id, column_id, done_id, category_id = delete_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id)
    selected = _occurrence(engine, series_id, NEXT_FRIDAY)
    _complete(engine, selected.id, done_id, selected.version)
    _delete(engine, selected.id, delete_scope="this", confirm_completed=True)
    assert selected.id not in _task_ids(engine, series_id)
    assert NEXT_FRIDAY in _exception_dates(engine, series_id)
    with independent_session(engine) as db:
        recurrence_service.generate_for_request(
            db, BOOTSTRAP_USER_ID, series_id, FRIDAY, date(2026, 10, 23)
        )
        assert (
            db.scalar(
                select(Task).where(
                    Task.recurrence_series_id == series_id,
                    Task.original_occurrence_date == NEXT_FRIDAY,
                )
            )
            is None
        )


def test_delete_one_detached_occurrence(delete_board) -> None:
    engine, _board_id, column_id, _done_id, category_id = delete_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id)
    selected = _occurrence(engine, series_id, NEXT_FRIDAY)
    other = _occurrence(engine, series_id, THIRD_FRIDAY)
    _detach(engine, selected.id, "Custom only")
    _detach(engine, other.id, "Keep me")
    _delete(engine, selected.id, delete_scope="this")
    with independent_session(engine) as db:
        series = db.get(TaskRecurrenceSeries, series_id)
        kept = db.get(Task, other.id)
        assert series is not None and kept is not None
        assert series.status == "active"
        assert db.get(Task, selected.id) is None
        assert kept.is_detached is True
        assert kept.title == "Keep me"
    assert NEXT_FRIDAY in _exception_dates(engine, series_id)
    with independent_session(engine) as db:
        recurrence_service.generate_for_request(db, BOOTSTRAP_USER_ID, series_id, FRIDAY, date(2026, 10, 23))
    assert selected.id not in _task_ids(engine, series_id)


def test_this_and_following_truncates_the_series(delete_board) -> None:
    engine, _board_id, column_id, _done_id, category_id = delete_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id)
    first = _occurrence(engine, series_id, FRIDAY)
    selected = _occurrence(engine, series_id, NEXT_FRIDAY)
    later = _occurrence(engine, series_id, THIRD_FRIDAY)
    _delete(engine, selected.id, delete_scope="this_and_future")
    with independent_session(engine) as db:
        series = db.get(TaskRecurrenceSeries, series_id)
        assert series is not None
        assert series.until_date == date(2026, 8, 27)
        assert series.status == "active"
        assert db.get(Task, first.id) is not None
        assert db.get(Task, selected.id) is None
        assert db.get(Task, later.id) is None
    with independent_session(engine) as db:
        result = recurrence_service.generate_for_request(
            db, BOOTSTRAP_USER_ID, series_id, FRIDAY, date(2026, 10, 23)
        )
        assert result.created == 0
    assert selected.id not in _task_ids(engine, series_id)
    assert later.id not in _task_ids(engine, series_id)


def test_this_and_following_stops_when_cutoff_at_series_start(delete_board) -> None:
    engine, _board_id, column_id, _done_id, category_id = delete_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id)
    first = _occurrence(engine, series_id, FRIDAY)
    later = _occurrence(engine, series_id, NEXT_FRIDAY)
    _delete(engine, first.id, delete_scope="this_and_future")
    with independent_session(engine) as db:
        series = db.get(TaskRecurrenceSeries, series_id)
        assert series is not None
        assert series.status == "stopped"
        assert db.get(Task, first.id) is None
        assert db.get(Task, later.id) is None
    with independent_session(engine) as db:
        result = recurrence_service.generate_for_request(
            db, BOOTSTRAP_USER_ID, series_id, FRIDAY, date(2026, 10, 23)
        )
        assert result.created == 0


def test_this_and_following_preserves_earlier_completed_and_detached(delete_board) -> None:
    engine, _board_id, column_id, done_id, category_id = delete_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id)
    first = _occurrence(engine, series_id, FRIDAY)
    selected = _occurrence(engine, series_id, NEXT_FRIDAY)
    later = _occurrence(engine, series_id, THIRD_FRIDAY)
    _complete(engine, first.id, done_id, first.version)
    _detach(engine, later.id, "Unrelated custom")
    _delete(engine, selected.id, delete_scope="this_and_future")
    with independent_session(engine) as db:
        completed = db.get(Task, first.id)
        detached = db.get(Task, later.id)
        series = db.get(TaskRecurrenceSeries, series_id)
        assert completed is not None and detached is not None and series is not None
        assert completed.completed_at is not None
        assert detached.is_detached is True
        assert detached.title == "Unrelated custom"
        assert series.until_date == date(2026, 8, 27)
        assert db.get(Task, selected.id) is None


def test_this_and_following_deletes_selected_detached_and_truncates(delete_board) -> None:
    engine, _board_id, column_id, _done_id, category_id = delete_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id)
    first = _occurrence(engine, series_id, FRIDAY)
    selected = _occurrence(engine, series_id, NEXT_FRIDAY)
    later = _occurrence(engine, series_id, THIRD_FRIDAY)
    other_detached = later
    _detach(engine, selected.id, "Selected custom")
    _detach(engine, other_detached.id, "Keep custom")
    _delete(engine, selected.id, delete_scope="this_and_future")
    with independent_session(engine) as db:
        series = db.get(TaskRecurrenceSeries, series_id)
        kept_first = db.get(Task, first.id)
        kept_custom = db.get(Task, other_detached.id)
        assert series is not None and kept_first is not None and kept_custom is not None
        assert series.until_date == date(2026, 8, 27)
        assert db.get(Task, selected.id) is None
        assert kept_custom.is_detached is True
        assert kept_custom.title == "Keep custom"
    assert NEXT_FRIDAY in _exception_dates(engine, series_id)
    with independent_session(engine) as db:
        recurrence_service.generate_for_request(db, BOOTSTRAP_USER_ID, series_id, FRIDAY, date(2026, 10, 23))
    assert selected.id not in _task_ids(engine, series_id)


def test_all_unfinished_stops_series_and_deletes_open_attached(delete_board) -> None:
    engine, _board_id, column_id, _done_id, category_id = delete_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id)
    first = _occurrence(engine, series_id, FRIDAY)
    selected = _occurrence(engine, series_id, NEXT_FRIDAY)
    later = _occurrence(engine, series_id, THIRD_FRIDAY)
    _delete(engine, selected.id, delete_scope="series")
    with independent_session(engine) as db:
        series = db.get(TaskRecurrenceSeries, series_id)
        assert series is not None
        assert series.status == "stopped"
        assert db.get(Task, first.id) is None
        assert db.get(Task, selected.id) is None
        assert db.get(Task, later.id) is None
    with independent_session(engine) as db:
        result = recurrence_service.generate_for_request(
            db, BOOTSTRAP_USER_ID, series_id, FRIDAY, date(2026, 10, 23)
        )
        assert result.created == 0


def test_all_unfinished_preserves_completed_and_detached_history(delete_board) -> None:
    engine, _board_id, column_id, done_id, category_id = delete_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id)
    first = _occurrence(engine, series_id, FRIDAY)
    selected = _occurrence(engine, series_id, NEXT_FRIDAY)
    later = _occurrence(engine, series_id, THIRD_FRIDAY)
    _complete(engine, first.id, done_id, first.version)
    _detach(engine, later.id, "Keep custom")
    _delete(engine, selected.id, delete_scope="series")
    with independent_session(engine) as db:
        series = db.get(TaskRecurrenceSeries, series_id)
        completed = db.get(Task, first.id)
        detached = db.get(Task, later.id)
        assert series is not None and completed is not None and detached is not None
        assert series.status == "stopped"
        assert completed.completed_at is not None
        assert detached.is_detached is True
        assert detached.title == "Keep custom"
        assert db.get(Task, selected.id) is None


def test_board_and_today_do_not_recreate_deleted_occurrences(delete_board) -> None:
    engine, board_id, column_id, _done_id, category_id = delete_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id)
    selected = _occurrence(engine, series_id, NEXT_FRIDAY)
    _delete(engine, selected.id, delete_scope="this")
    with independent_session(engine) as db:
        view = board_service.get_board_view(
            db,
            BOOTSTRAP_USER_ID,
            board_id,
            start_date=NEXT_FRIDAY,
            end_date=THIRD_FRIDAY,
        )
        ids = {task.id for column in view.columns for task in column.tasks}
        assert selected.id not in ids
        today = today_service.get_today(db, BOOTSTRAP_USER_ID, NEXT_FRIDAY)
        today_ids = {item.id for item in today.active_tasks + today.overdue_tasks}
        assert selected.id not in today_ids
    with independent_session(engine) as db:
        assert (
            db.scalar(
                select(Task).where(
                    Task.recurrence_series_id == series_id,
                    Task.original_occurrence_date == NEXT_FRIDAY,
                )
            )
            is None
        )


def test_repeated_generation_after_delete_is_idempotent(delete_board) -> None:
    engine, _board_id, column_id, _done_id, category_id = delete_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id)
    selected = _occurrence(engine, series_id, NEXT_FRIDAY)
    _delete(engine, selected.id, delete_scope="this_and_future")
    with independent_session(engine) as db:
        first = recurrence_service.generate_for_request(
            db, BOOTSTRAP_USER_ID, series_id, FRIDAY, date(2026, 10, 23)
        )
        assert first.created == 0
    with independent_session(engine) as db:
        second = recurrence_service.generate_for_request(
            db, BOOTSTRAP_USER_ID, series_id, FRIDAY, date(2026, 10, 23)
        )
        assert second.created == 0
        originals = list(
            db.scalars(select(Task.original_occurrence_date).where(Task.recurrence_series_id == series_id)).all()
        )
        assert len(originals) == len(set(originals))


def test_cross_user_deletion_returns_404(delete_board) -> None:
    engine, _board_id, column_id, _done_id, category_id = delete_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id)
    selected = _occurrence(engine, series_id, NEXT_FRIDAY)
    other_id = None
    try:
        with independent_session(engine) as db:
            other = User(
                email=f"delete-other-{uuid4().hex[:8]}@example.com",
                display_name="Other",
                password_hash="x",
                timezone="UTC",
            )
            db.add(other)
            db.commit()
            db.refresh(other)
            other_id = other.id
        with independent_session(engine) as db:
            with pytest.raises(HTTPException) as exc:
                task_service.delete_task(
                    db, other_id, selected.id, delete_scope="this", confirm_completed=False
                )
            assert exc.value.status_code == 404
        with independent_session(engine) as db:
            assert db.get(Task, selected.id) is not None
    finally:
        if other_id is not None:
            with independent_session(engine) as db:
                row = db.get(User, other_id)
                if row is not None:
                    db.delete(row)
                    db.commit()


def test_invalid_delete_scope_returns_422(delete_board) -> None:
    engine, _board_id, column_id, _done_id, category_id = delete_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id)
    selected = _occurrence(engine, series_id, NEXT_FRIDAY)
    with pytest.raises(HTTPException) as exc:
        _delete(engine, selected.id, delete_scope="nope")
    assert exc.value.status_code == 422
    with independent_session(engine) as db:
        assert db.get(Task, selected.id) is not None


def test_non_recurring_delete_ignores_scope(delete_board) -> None:
    engine, _board_id, column_id, _done_id, category_id = delete_board
    with independent_session(engine) as db:
        created = task_service.create_task(
            db,
            BOOTSTRAP_USER_ID,
            TaskCreate(
                column_id=column_id,
                category_id=category_id,
                title="One off",
                start_date=FRIDAY,
                due_date=FRIDAY,
            ),
        )
        task_id = created.id
    _delete(engine, task_id, delete_scope="series")
    with independent_session(engine) as db:
        assert db.get(Task, task_id) is None


def test_attachment_cleanup_affects_only_deleted_tasks(delete_board) -> None:
    engine, _board_id, column_id, _done_id, category_id = delete_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id)
    selected = _occurrence(engine, series_id, NEXT_FRIDAY)
    kept = _occurrence(engine, series_id, THIRD_FRIDAY)
    storage = get_storage()
    deleted_key, kept_key = None, None
    try:
        deleted_key, _kind, size = storage.save(
            original_name="gone.txt", content_type="text/plain", data=b"delete-me"
        )
        kept_key, _kind2, size2 = storage.save(
            original_name="keep.txt", content_type="text/plain", data=b"keep-me"
        )
        with independent_session(engine) as db:
            db.add(
                TaskAttachment(
                    task_id=selected.id,
                    original_name="gone.txt",
                    storage_key=deleted_key,
                    content_type="text/plain",
                    size_bytes=size,
                    attachment_kind="file",
                )
            )
            db.add(
                TaskAttachment(
                    task_id=kept.id,
                    original_name="keep.txt",
                    storage_key=kept_key,
                    content_type="text/plain",
                    size_bytes=size2,
                    attachment_kind="file",
                )
            )
            db.commit()
        _delete(engine, selected.id, delete_scope="this")
        deleted_path = Path(storage.root) / deleted_key
        kept_path = Path(storage.root) / kept_key
        assert not deleted_path.exists()
        assert kept_path.is_file()
        with independent_session(engine) as db:
            assert db.scalar(select(TaskAttachment).where(TaskAttachment.storage_key == deleted_key)) is None
            kept_row = db.scalar(select(TaskAttachment).where(TaskAttachment.storage_key == kept_key))
            assert kept_row is not None
            assert kept_row.task_id == kept.id
    finally:
        if kept_key:
            storage.delete(kept_key)
        if deleted_key:
            storage.delete(deleted_key)


def test_remaining_task_positions_are_valid(delete_board) -> None:
    engine, _board_id, column_id, _done_id, category_id = delete_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id)
    with independent_session(engine) as db:
        extra = task_service.create_task(
            db,
            BOOTSTRAP_USER_ID,
            TaskCreate(
                column_id=column_id,
                category_id=category_id,
                title="Anchor",
                start_date=FRIDAY,
                due_date=FRIDAY,
            ),
        )
        extra_id = extra.id
    selected = _occurrence(engine, series_id, NEXT_FRIDAY)
    later = _occurrence(engine, series_id, THIRD_FRIDAY)
    _delete(engine, selected.id, delete_scope="this_and_future")
    _assert_contiguous_positions(engine, column_id)
    with independent_session(engine) as db:
        assert db.get(Task, extra_id) is not None
        assert db.get(Task, later.id) is None
