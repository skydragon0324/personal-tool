from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import date, timedelta
from pathlib import Path
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.constants import BOOTSTRAP_USER_ID
from app.models import Board, BoardColumn, Category, Task, TaskAttachment, User
from app.models.task_recurrence import TaskRecurrenceException, TaskRecurrenceSeries
from app.schemas.board import BoardCreate
from app.schemas.category import CategoryCreate
from app.schemas.column import ColumnArchive, ColumnCreate
from app.schemas.recurrence import RecurrenceInput, RecurrenceSeriesLinkInput, RecurrenceSeriesUpdate
from app.schemas.task import Priority, TaskCreate, TaskLinkInput, TaskMove, TaskUpdate
from app.services import board_service, category_service, column_service, recurrence_service, task_ordering_service, task_service
from app.services.storage import get_storage

FRIDAY = date(2026, 8, 21)
SATURDAY = date(2026, 8, 22)
NEXT_FRIDAY = date(2026, 8, 28)
THIRD_FRIDAY = date(2026, 9, 4)
CONTENT_V1 = {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "v1"}]}]}
CONTENT_V2 = {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "v2"}]}]}
CHECKED = {
    "type": "doc",
    "content": [
        {
            "type": "taskList",
            "content": [{"type": "taskItem", "attrs": {"checked": True}, "content": [{"type": "text", "text": "box"}]}],
        }
    ],
}
UNSAFE = {
    "type": "doc",
    "content": [{"type": "image", "attrs": {"src": "javascript:alert(1)", "alt": "bad"}}],
}


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
def edit_api_board(test_engine: Engine) -> Iterator[tuple[Engine, UUID, UUID, UUID, UUID, UUID]]:
    with independent_session(test_engine) as db:
        created = board_service.create_board(
            db,
            BOOTSTRAP_USER_ID,
            BoardCreate(name=f"Series edit {uuid4().hex[:8]}"),
        )
        db.commit()
        columns = list(
            db.scalars(
                select(BoardColumn)
                .where(BoardColumn.board_id == created.id, BoardColumn.archived_at.is_(None))
                .order_by(BoardColumn.position)
            ).all()
        )
        active = [column for column in columns if not column.is_done]
        todo, doing = active[0], active[1]
        done = next(column for column in columns if column.is_done)
        category = db.scalar(
            select(Category).where(Category.board_id == created.id).order_by(Category.position)
        )
        assert category is not None
        ids = (created.id, todo.id, doing.id, done.id, category.id)
    try:
        yield test_engine, *ids
    finally:
        _delete_board(test_engine, ids[0])


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
                recurrence=recurrence or RecurrenceInput(freq="weekly", interval=1, weekdays=[4]),
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


def _read(engine: Engine, series_id: UUID):
    with independent_session(engine) as db:
        return recurrence_service.read_series(db, BOOTSTRAP_USER_ID, series_id)


def _patch(engine: Engine, series_id: UUID, **fields):
    with independent_session(engine) as db:
        current = recurrence_service.read_series(db, BOOTSTRAP_USER_ID, series_id)
        expected = fields.pop("expected_version", current.version)
        return recurrence_service.update_series(
            db,
            BOOTSTRAP_USER_ID,
            series_id,
            RecurrenceSeriesUpdate(expected_version=expected, **fields),
        )


def _complete(engine: Engine, task_id: UUID, done_id: UUID, version: int) -> None:
    with independent_session(engine) as db:
        task_ordering_service.move_task(
            db,
            BOOTSTRAP_USER_ID,
            task_id,
            TaskMove(target_column_id=done_id, expected_version=version, target_position=0),
        )


def test_update_schema_rejects_blank_title_and_null_recurrence() -> None:
    with pytest.raises(ValidationError):
        RecurrenceSeriesUpdate(expected_version=1, title="   ")
    with pytest.raises(ValidationError):
        RecurrenceSeriesUpdate(expected_version=1, recurrence=None)
    with pytest.raises(ValidationError):
        RecurrenceSeriesUpdate(expected_version=1, duration_days=-1)


def test_get_detail_includes_version_content_and_links(edit_api_board) -> None:
    engine, _board_id, column_id, _doing_id, _done_id, category_id = edit_api_board
    series_id = _create_series(
        engine,
        column_id=column_id,
        category_id=category_id,
        title="Weekly",
        content=CONTENT_V1,
        links=[TaskLinkInput(label="Docs", url="https://example.com/docs", position=0)],
    )
    body = _read(engine, series_id)
    assert body.version >= 1
    assert body.content == CONTENT_V1
    assert body.content_schema_version == 1
    assert len(body.links) == 1
    assert body.links[0].label == "Docs"
    assert body.links[0].url == "https://example.com/docs"
    assert body.links[0].position == 0
    assert body.links[0].id is not None


def test_other_user_get_and_patch_are_404(edit_api_board) -> None:
    engine, _board_id, column_id, _doing_id, _done_id, category_id = edit_api_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Mine")
    other_id = None
    try:
        with independent_session(engine) as db:
            other = User(
                email=f"series-edit-{uuid4().hex[:8]}@example.com",
                display_name="Other",
                password_hash="x",
                timezone="UTC",
            )
            db.add(other)
            db.commit()
            db.refresh(other)
            other_id = other.id
        with independent_session(engine) as db:
            with pytest.raises(HTTPException) as get_exc:
                recurrence_service.read_series(db, other_id, series_id)
            assert get_exc.value.status_code == 404
            with pytest.raises(HTTPException) as patch_exc:
                recurrence_service.update_series(
                    db,
                    other_id,
                    series_id,
                    RecurrenceSeriesUpdate(expected_version=1, title="Stolen"),
                )
            assert patch_exc.value.status_code == 404
        assert _read(engine, series_id).title == "Mine"
    finally:
        if other_id is not None:
            with independent_session(engine) as db:
                row = db.get(User, other_id)
                if row is not None:
                    db.delete(row)
                    db.commit()


def test_title_and_priority_update(edit_api_board) -> None:
    engine, _board_id, column_id, _doing_id, _done_id, category_id = edit_api_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Weekly")
    body = _patch(engine, series_id, title="  Renamed  ", priority="high")
    assert body.title == "Renamed"
    assert body.priority == "high"
    assert body.version == _read(engine, series_id).version


def test_content_and_links_update(edit_api_board) -> None:
    engine, _board_id, column_id, _doing_id, _done_id, category_id = edit_api_board
    series_id = _create_series(
        engine,
        column_id=column_id,
        category_id=category_id,
        title="Weekly",
        content=CONTENT_V1,
        links=[TaskLinkInput(label="Old", url="https://example.com/old", position=0)],
    )
    body = _patch(
        engine,
        series_id,
        content=CONTENT_V2,
        links=[RecurrenceSeriesLinkInput(label="New", url="https://example.com/new", position=0)],
    )
    assert body.content == CONTENT_V2
    assert body.links[0].label == "New"
    assert body.links[0].url == "https://example.com/new"


def test_unsafe_content_and_link_urls_are_rejected(edit_api_board) -> None:
    engine, _board_id, column_id, _doing_id, _done_id, category_id = edit_api_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Weekly")
    version = _read(engine, series_id).version
    with pytest.raises(HTTPException) as content_exc:
        _patch(engine, series_id, content=UNSAFE)
    assert content_exc.value.status_code == 422
    with pytest.raises((HTTPException, ValidationError)):
        RecurrenceSeriesUpdate(
            expected_version=version,
            links=[RecurrenceSeriesLinkInput(label="Bad", url="javascript:alert(1)", position=0)],
        )
    assert _read(engine, series_id).title == "Weekly"
    assert _read(engine, series_id).version == version


def test_category_must_belong_to_same_board(edit_api_board) -> None:
    engine, board_id, column_id, _doing_id, _done_id, category_id = edit_api_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Weekly")
    with independent_session(engine) as db:
        other = board_service.create_board(
            db, BOOTSTRAP_USER_ID, BoardCreate(name=f"Other {uuid4().hex[:8]}")
        )
        foreign = db.scalar(select(Category).where(Category.board_id == other.id))
        assert foreign is not None
        other_id, foreign_id = other.id, foreign.id
    try:
        with pytest.raises(HTTPException) as exc:
            _patch(engine, series_id, title="Nope", category_id=foreign_id)
        assert exc.value.status_code == 422
        assert _read(engine, series_id).title == "Weekly"
        assert _read(engine, series_id).category_id == category_id
    finally:
        _delete_board(engine, other_id)


def test_default_column_must_belong_to_same_board(edit_api_board) -> None:
    engine, _board_id, column_id, _doing_id, _done_id, category_id = edit_api_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Weekly")
    with independent_session(engine) as db:
        other = board_service.create_board(
            db, BOOTSTRAP_USER_ID, BoardCreate(name=f"Other col {uuid4().hex[:8]}")
        )
        other_todo = db.scalar(
            select(BoardColumn)
            .where(BoardColumn.board_id == other.id, BoardColumn.is_done.is_(False))
            .order_by(BoardColumn.position)
        )
        assert other_todo is not None
        other_id, foreign_col = other.id, other_todo.id
    try:
        with pytest.raises(HTTPException) as exc:
            _patch(engine, series_id, default_column_id=foreign_col)
        assert exc.value.status_code == 422
        assert _read(engine, series_id).default_column_id == column_id
    finally:
        _delete_board(engine, other_id)


def test_archived_and_done_columns_are_rejected(edit_api_board) -> None:
    engine, board_id, column_id, _doing_id, done_id, category_id = edit_api_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Weekly")
    with independent_session(engine) as db:
        parked = column_service.create_column(
            db, BOOTSTRAP_USER_ID, board_id, ColumnCreate(name=f"Parked {uuid4().hex[:6]}")
        )
        column_service.archive_column(
            db, BOOTSTRAP_USER_ID, parked.id, ColumnArchive()
        )
        parked_id = parked.id
    with pytest.raises(HTTPException) as archived_exc:
        _patch(engine, series_id, default_column_id=parked_id)
    assert archived_exc.value.status_code == 422
    with pytest.raises(HTTPException) as done_exc:
        _patch(engine, series_id, default_column_id=done_id)
    assert done_exc.value.status_code == 422


def test_archived_board_and_series_are_rejected(edit_api_board) -> None:
    engine, board_id, column_id, _doing_id, _done_id, category_id = edit_api_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Weekly")
    with independent_session(engine) as db:
        series = db.get(TaskRecurrenceSeries, series_id)
        assert series is not None
        series.status = "archived"
        db.commit()
    with pytest.raises(HTTPException) as series_exc:
        _patch(engine, series_id, title="No")
    assert series_exc.value.status_code == 409
    with independent_session(engine) as db:
        series = db.get(TaskRecurrenceSeries, series_id)
        assert series is not None
        series.status = "active"
        db.commit()
    with independent_session(engine) as db:
        board_service.archive_board(db, BOOTSTRAP_USER_ID, board_id)
    with pytest.raises(HTTPException) as board_exc:
        _patch(engine, series_id, title="No")
    assert board_exc.value.status_code == 409
    assert _read(engine, series_id).title == "Weekly"


def test_version_conflict_is_409(edit_api_board) -> None:
    engine, _board_id, column_id, _doing_id, _done_id, category_id = edit_api_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Weekly")
    version = _read(engine, series_id).version
    with pytest.raises(HTTPException) as exc:
        _patch(engine, series_id, expected_version=999, title="Stale")
    assert exc.value.status_code == 409
    assert _read(engine, series_id).title == "Weekly"
    assert _read(engine, series_id).version == version


def test_noop_patch_does_not_bump_version(edit_api_board) -> None:
    engine, _board_id, column_id, _doing_id, _done_id, category_id = edit_api_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Weekly")
    before = _read(engine, series_id)
    after = _patch(engine, series_id, title="Weekly")
    assert after.version == before.version
    assert after.title == "Weekly"


def test_template_changes_apply_to_open_attached_only(edit_api_board) -> None:
    engine, board_id, column_id, _doing_id, done_id, category_id = edit_api_board
    series_id = _create_series(
        engine,
        column_id=column_id,
        category_id=category_id,
        title="Weekly",
        content=CONTENT_V1,
    )
    first = _occurrence(engine, series_id, FRIDAY)
    later = _occurrence(engine, series_id, NEXT_FRIDAY)
    third = _occurrence(engine, series_id, THIRD_FRIDAY)
    _complete(engine, first.id, done_id, first.version)
    with independent_session(engine) as db:
        task_service.update_task(
            db,
            BOOTSTRAP_USER_ID,
            third.id,
            TaskUpdate(title="Custom", edit_scope="this"),
        )
        extra = category_service.create_category(
            db, BOOTSTRAP_USER_ID, board_id, CategoryCreate(name=f"Focus {uuid4().hex[:6]}")
        )
        extra_id = extra.id
    _patch(
        engine,
        series_id,
        title="Series title",
        priority="low",
        category_id=extra_id,
        content=CHECKED,
    )
    with independent_session(engine) as db:
        completed = db.get(Task, first.id)
        attached = db.get(Task, later.id)
        detached = db.get(Task, third.id)
        series = db.get(TaskRecurrenceSeries, series_id)
        assert completed is not None and attached is not None and detached is not None and series is not None
        assert completed.title == "Weekly"
        assert completed.content == CONTENT_V1
        assert detached.title == "Custom"
        assert attached.title == "Series title"
        assert attached.priority == "low"
        assert attached.category_id == extra_id
        assert attached.content is not None
        assert attached.content["content"][0]["content"][0]["attrs"]["checked"] is False
        assert series.title == "Series title"


def test_duration_updates_open_due_dates(edit_api_board) -> None:
    engine, _board_id, column_id, _doing_id, done_id, category_id = edit_api_board
    series_id = _create_series(
        engine,
        column_id=column_id,
        category_id=category_id,
        title="Weekly",
        due=FRIDAY,
    )
    first = _occurrence(engine, series_id, FRIDAY)
    later = _occurrence(engine, series_id, NEXT_FRIDAY)
    _complete(engine, first.id, done_id, first.version)
    _patch(engine, series_id, duration_days=2)
    with independent_session(engine) as db:
        completed = db.get(Task, first.id)
        attached = db.get(Task, later.id)
        assert completed is not None and attached is not None
        assert completed.due_date == FRIDAY
        assert attached.due_date == NEXT_FRIDAY + timedelta(days=2)


def test_default_column_change_does_not_move_existing_tasks(edit_api_board) -> None:
    engine, _board_id, column_id, doing_id, _done_id, category_id = edit_api_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Weekly")
    first = _occurrence(engine, series_id, FRIDAY)
    body = _patch(engine, series_id, default_column_id=doing_id)
    assert body.default_column_id == doing_id
    with independent_session(engine) as db:
        task = db.get(Task, first.id)
        assert task is not None
        assert task.column_id == column_id


def test_rule_change_purges_invalid_open_and_refills_active(edit_api_board) -> None:
    engine, _board_id, column_id, _doing_id, done_id, category_id = edit_api_board
    series_id = _create_series(
        engine,
        column_id=column_id,
        category_id=category_id,
        title="Daily",
        recurrence=RecurrenceInput(freq="daily", interval=1),
    )
    first = _occurrence(engine, series_id, FRIDAY)
    saturday = _occurrence(engine, series_id, SATURDAY)
    friday_two = _occurrence(engine, series_id, NEXT_FRIDAY)
    _complete(engine, first.id, done_id, first.version)
    _patch(engine, series_id, recurrence=RecurrenceInput(freq="weekly", interval=1, weekdays=[4]))
    with independent_session(engine) as db:
        assert db.get(Task, first.id) is not None
        assert db.get(Task, saturday.id) is None
        kept = db.get(Task, friday_two.id)
        assert kept is not None
        series = db.get(TaskRecurrenceSeries, series_id)
        assert series is not None
        assert series.freq == "weekly"
        dates = [
            item.original_occurrence_date
            for item in db.scalars(select(Task).where(Task.recurrence_series_id == series_id)).all()
            if item.completed_at is None and item.is_detached is False
        ]
        assert SATURDAY not in dates
        assert all(item is not None and item.weekday() == 4 for item in dates)
        originals = [
            item.original_occurrence_date
            for item in db.scalars(select(Task).where(Task.recurrence_series_id == series_id)).all()
        ]
        assert len(originals) == len(set(originals))


def test_stopped_series_rule_change_does_not_create_occurrences(edit_api_board) -> None:
    engine, _board_id, column_id, _doing_id, _done_id, category_id = edit_api_board
    series_id = _create_series(
        engine,
        column_id=column_id,
        category_id=category_id,
        title="Daily",
        recurrence=RecurrenceInput(freq="daily", interval=1),
    )
    saturday = _occurrence(engine, series_id, SATURDAY)
    with independent_session(engine) as db:
        recurrence_service.stop_series(db, BOOTSTRAP_USER_ID, series_id)
    before = _read(engine, series_id)
    _patch(engine, series_id, recurrence=RecurrenceInput(freq="weekly", interval=1, weekdays=[4]))
    after = _read(engine, series_id)
    assert after.status == "stopped"
    with independent_session(engine) as db:
        assert db.get(Task, saturday.id) is None
        open_dates = [
            item.original_occurrence_date
            for item in db.scalars(select(Task).where(Task.recurrence_series_id == series_id)).all()
            if item.completed_at is None and item.is_detached is False
        ]
        assert all(item is not None and item.weekday() == 4 for item in open_dates)
        assert after.open_count <= before.open_count


def test_exceptions_are_preserved(edit_api_board) -> None:
    engine, _board_id, column_id, _doing_id, _done_id, category_id = edit_api_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Weekly")
    with independent_session(engine) as db:
        db.add(TaskRecurrenceException(series_id=series_id, original_occurrence_date=THIRD_FRIDAY))
        db.commit()
    _patch(engine, series_id, title="Still excepted")
    _patch(engine, series_id, recurrence=RecurrenceInput(freq="weekly", interval=1, weekdays=[4]))
    with independent_session(engine) as db:
        dates = set(
            db.scalars(
                select(TaskRecurrenceException.original_occurrence_date).where(
                    TaskRecurrenceException.series_id == series_id
                )
            ).all()
        )
        assert THIRD_FRIDAY in dates


def test_task_positions_stay_contiguous_after_rule_purge(edit_api_board) -> None:
    engine, _board_id, column_id, _doing_id, _done_id, category_id = edit_api_board
    series_id = _create_series(
        engine,
        column_id=column_id,
        category_id=category_id,
        title="Daily",
        recurrence=RecurrenceInput(freq="daily", interval=1),
    )
    _patch(engine, series_id, recurrence=RecurrenceInput(freq="weekly", interval=1, weekdays=[4]))
    with independent_session(engine) as db:
        positions = list(
            db.scalars(select(Task.position).where(Task.column_id == column_id).order_by(Task.position)).all()
        )
        assert positions == list(range(len(positions)))


def test_storage_is_deleted_only_after_commit(edit_api_board, monkeypatch: pytest.MonkeyPatch) -> None:
    engine, _board_id, column_id, _doing_id, _done_id, category_id = edit_api_board
    series_id = _create_series(
        engine,
        column_id=column_id,
        category_id=category_id,
        title="Daily",
        recurrence=RecurrenceInput(freq="daily", interval=1),
    )
    saturday = _occurrence(engine, series_id, SATURDAY)
    storage = get_storage()
    key, _kind, size = storage.save(original_name="gone.txt", content_type="text/plain", data=b"delete-me")
    try:
        with independent_session(engine) as db:
            db.add(
                TaskAttachment(
                    task_id=saturday.id,
                    original_name="gone.txt",
                    storage_key=key,
                    content_type="text/plain",
                    size_bytes=size,
                    attachment_kind="file",
                )
            )
            db.commit()
        order: list[str] = []
        original_delete = storage.delete

        def tracked_delete(item: str) -> None:
            order.append("delete")
            original_delete(item)

        monkeypatch.setattr(recurrence_service, "get_storage", lambda: storage)
        storage.delete = tracked_delete  # type: ignore[method-assign]
        with independent_session(engine) as db:
            original_commit = db.commit

            def tracked_commit() -> None:
                order.append("commit")
                original_commit()

            db.commit = tracked_commit  # type: ignore[method-assign]
            current = recurrence_service.read_series(db, BOOTSTRAP_USER_ID, series_id)
            recurrence_service.update_series(
                db,
                BOOTSTRAP_USER_ID,
                series_id,
                RecurrenceSeriesUpdate(
                    expected_version=current.version,
                    recurrence=RecurrenceInput(freq="weekly", interval=1, weekdays=[4]),
                ),
            )
        assert "commit" in order
        assert "delete" in order
        assert order.index("commit") < order.index("delete")
        assert not (Path(storage.root) / key).exists()
    finally:
        storage.delete(key)


def test_failed_commit_does_not_delete_storage(edit_api_board, monkeypatch: pytest.MonkeyPatch) -> None:
    engine, _board_id, column_id, _doing_id, _done_id, category_id = edit_api_board
    series_id = _create_series(
        engine,
        column_id=column_id,
        category_id=category_id,
        title="Daily",
        recurrence=RecurrenceInput(freq="daily", interval=1),
    )
    saturday = _occurrence(engine, series_id, SATURDAY)
    storage = get_storage()
    key, _kind, size = storage.save(original_name="keep.txt", content_type="text/plain", data=b"keep-me")
    deleted = False
    try:
        with independent_session(engine) as db:
            db.add(
                TaskAttachment(
                    task_id=saturday.id,
                    original_name="keep.txt",
                    storage_key=key,
                    content_type="text/plain",
                    size_bytes=size,
                    attachment_kind="file",
                )
            )
            db.commit()
        original_delete = storage.delete

        def tracked_delete(item: str) -> None:
            nonlocal deleted
            deleted = True
            original_delete(item)

        monkeypatch.setattr(recurrence_service, "get_storage", lambda: storage)
        storage.delete = tracked_delete  # type: ignore[method-assign]
        with independent_session(engine) as db:
            db.commit = lambda: (_ for _ in ()).throw(RuntimeError("boom"))  # type: ignore[method-assign]
            current = recurrence_service.read_series(db, BOOTSTRAP_USER_ID, series_id)
            with pytest.raises(RuntimeError):
                recurrence_service.update_series(
                    db,
                    BOOTSTRAP_USER_ID,
                    series_id,
                    RecurrenceSeriesUpdate(
                        expected_version=current.version,
                        recurrence=RecurrenceInput(freq="weekly", interval=1, weekdays=[4]),
                    ),
                )
        assert deleted is False
        assert (Path(storage.root) / key).is_file()
        with independent_session(engine) as db:
            assert db.get(Task, saturday.id) is not None
            series = db.get(TaskRecurrenceSeries, series_id)
            assert series is not None
            assert series.freq == "daily"
    finally:
        storage.delete(key)


def test_list_reflects_updated_title_rule_and_category(edit_api_board) -> None:
    engine, board_id, column_id, _doing_id, _done_id, category_id = edit_api_board
    series_id = _create_series(engine, column_id=column_id, category_id=category_id, title="Weekly")
    with independent_session(engine) as db:
        extra = category_service.create_category(
            db, BOOTSTRAP_USER_ID, board_id, CategoryCreate(name=f"Ops {uuid4().hex[:6]}")
        )
        extra_id, extra_name = extra.id, extra.name
    _patch(
        engine,
        series_id,
        title="Listed",
        category_id=extra_id,
        recurrence=RecurrenceInput(freq="weekly", interval=2, weekdays=[4]),
    )
    with independent_session(engine) as db:
        listed = recurrence_service.list_series(db, BOOTSTRAP_USER_ID, board_id=board_id)
    item = next(row for row in listed.items if row.id == series_id)
    assert item.title == "Listed"
    assert item.category_id == extra_id
    assert item.category_name == extra_name
    assert item.interval == 2
    assert item.weekdays == [4]
