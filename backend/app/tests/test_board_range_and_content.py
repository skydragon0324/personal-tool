from __future__ import annotations

from datetime import date, timedelta
from io import BytesIO
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.constants import BOOTSTRAP_USER_ID, COLUMN_TODO_ID, DEFAULT_BOARD_ID
from app.core.config import get_settings
from app.models import Task
from app.schemas.task import TaskCreate, TaskLinkInput, TaskUpdate
from app.services import board_service, task_service
from app.services.content_utils import count_checklist_items, extract_text_from_content
from app.services.storage import LocalStorageService
from app.services.url_validation import validate_http_url


def test_board_view_single_day(db: Session, seed_tasks: list[Task], today: date) -> None:
    view = board_service.get_board_view(db, BOOTSTRAP_USER_ID, DEFAULT_BOARD_ID, legacy_date=today)
    assert view.start_date == today.isoformat()
    assert view.end_date == today.isoformat()
    assert view.summary.total == 3


def test_board_view_inclusive_range(
    db: Session, seed_tasks: list[Task], today: date, uncategorized_id
) -> None:
    extra = Task(
        id=uuid4(),
        column_id=COLUMN_TODO_ID,
        category_id=uncategorized_id,
        title="Tomorrow",
        start_date=today + timedelta(days=1),
        due_date=today + timedelta(days=1),
        priority="low",
        position=3,
        version=1,
    )
    db.add(extra)
    db.commit()

    view = board_service.get_board_view(
        db,
        BOOTSTRAP_USER_ID,
        DEFAULT_BOARD_ID,
        start_date=today,
        end_date=today + timedelta(days=1),
    )
    titles = [t.title for col in view.columns for t in col.tasks]
    assert "Tomorrow" in titles
    assert view.summary.total == 4


def test_board_view_invalid_range(db: Session, today: date) -> None:
    with pytest.raises(HTTPException) as exc:
        board_service.get_board_view(
            db,
            BOOTSTRAP_USER_ID,
            DEFAULT_BOARD_ID,
            start_date=today,
            end_date=today - timedelta(days=1),
        )
    assert exc.value.status_code == 422


def test_board_view_range_too_long(db: Session, today: date) -> None:
    with pytest.raises(HTTPException) as exc:
        board_service.get_board_view(
            db,
            BOOTSTRAP_USER_ID,
            DEFAULT_BOARD_ID,
            start_date=today,
            end_date=today + timedelta(days=3654),
        )
    assert exc.value.status_code == 422


def test_board_view_full_leap_year(db: Session, today: date, uncategorized_id) -> None:
    leap = Task(
        id=uuid4(),
        column_id=COLUMN_TODO_ID,
        category_id=uncategorized_id,
        title="Leap day",
        start_date=date(2024, 2, 29),
        due_date=date(2024, 2, 29),
        priority="low",
        position=40,
        version=1,
    )
    db.add(leap)
    db.commit()
    view = board_service.get_board_view(
        db,
        BOOTSTRAP_USER_ID,
        DEFAULT_BOARD_ID,
        start_date=date(2024, 1, 1),
        end_date=date(2024, 12, 31),
    )
    titles = [task.title for column in view.columns for task in column.tasks]
    assert "Leap day" in titles


def test_board_view_month_end_and_year_spanning_week(
    db: Session, uncategorized_id
) -> None:
    jan = Task(
        id=uuid4(),
        column_id=COLUMN_TODO_ID,
        category_id=uncategorized_id,
        title="January last",
        start_date=date(2026, 1, 31),
        due_date=date(2026, 1, 31),
        priority="low",
        position=41,
        version=1,
    )
    new_year = Task(
        id=uuid4(),
        column_id=COLUMN_TODO_ID,
        category_id=uncategorized_id,
        title="New year",
        start_date=date(2026, 1, 1),
        due_date=date(2026, 1, 1),
        priority="low",
        position=42,
        version=1,
    )
    db.add_all([jan, new_year])
    db.commit()

    january = board_service.get_board_view(
        db,
        BOOTSTRAP_USER_ID,
        DEFAULT_BOARD_ID,
        start_date=date(2026, 1, 1),
        end_date=date(2026, 1, 31),
    )
    jan_titles = [task.title for column in january.columns for task in column.tasks]
    assert "January last" in jan_titles
    assert "New year" in jan_titles

    week = board_service.get_board_view(
        db,
        BOOTSTRAP_USER_ID,
        DEFAULT_BOARD_ID,
        start_date=date(2025, 12, 29),
        end_date=date(2026, 1, 4),
    )
    week_titles = [task.title for column in week.columns for task in column.tasks]
    assert "New year" in week_titles


def test_board_view_custom_ten_years_allowed(db: Session, today: date) -> None:
    view = board_service.get_board_view(
        db,
        BOOTSTRAP_USER_ID,
        DEFAULT_BOARD_ID,
        start_date=date(2016, 1, 1),
        end_date=date(2026, 1, 1),
    )
    assert view.start_date == "2016-01-01"
    assert view.end_date == "2026-01-01"


def test_board_view_legacy_date_param(client: TestClient, seed_tasks: list[Task], today: date) -> None:
    response = client.get(
        f"/api/v1/boards/{DEFAULT_BOARD_ID}/view",
        params={"date": today.isoformat()},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["start_date"] == today.isoformat()
    assert body["summary"]["total"] == 3
    tasks = [task for column in body["columns"] for task in column["tasks"]]
    assert tasks
    assert "content_preview" in tasks[0]


def test_due_date_change_repositions(db: Session, seed_tasks: list[Task], today: date) -> None:
    moving = seed_tasks[1]
    new_due = today + timedelta(days=2)
    result = task_service.update_task(
        db,
        BOOTSTRAP_USER_ID,
        moving.id,
        TaskUpdate(due_date=new_due),
    )
    assert result.due_date == new_due
    assert result.position == moving.position

    remaining = list(
        db.scalars(
            select(Task)
            .where(Task.column_id == COLUMN_TODO_ID, Task.due_date == today)
            .order_by(Task.position)
        ).all()
    )
    assert [t.title for t in remaining] == ["Alpha", "Charlie"]
    assert [t.position for t in remaining] == [0, 2]


def test_rich_content_create_update(db: Session, today: date, uncategorized_id) -> None:
    content = {
        "type": "doc",
        "content": [
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": "Hello world"}],
            },
            {
                "type": "taskList",
                "content": [
                    {
                        "type": "taskItem",
                        "attrs": {"checked": True},
                        "content": [
                            {
                                "type": "paragraph",
                                "content": [{"type": "text", "text": "Done item"}],
                            }
                        ],
                    },
                    {
                        "type": "taskItem",
                        "attrs": {"checked": False},
                        "content": [
                            {
                                "type": "paragraph",
                                "content": [{"type": "text", "text": "Open item"}],
                            }
                        ],
                    },
                ],
            },
        ],
    }
    created = task_service.create_task(
        db,
        BOOTSTRAP_USER_ID,
        TaskCreate(
            column_id=COLUMN_TODO_ID,
            category_id=uncategorized_id,
            title="Rich",
            due_date=today,
            content=content,
            links=[TaskLinkInput(label="Docs", url="https://example.com", position=0)],
        ),
    )
    assert created.content_text and "Hello world" in created.content_text
    assert len(created.links) == 1
    done, total = count_checklist_items(created.content)
    assert (done, total) == (1, 2)

    updated = task_service.update_task(
        db,
        BOOTSTRAP_USER_ID,
        created.id,
        TaskUpdate(content={"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Updated"}]}]}),
    )
    assert updated.content_text == "Updated"


def test_link_url_validation() -> None:
    assert validate_http_url("https://example.com/path") == "https://example.com/path"
    with pytest.raises(HTTPException):
        validate_http_url("javascript:alert(1)")
    with pytest.raises(HTTPException):
        validate_http_url("data:text/html,hi")


def test_attachment_upload_download_delete(
    client: TestClient,
    db: Session,
    today: date,
    uncategorized_id,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path))
    get_settings.cache_clear()

    created = task_service.create_task(
        db,
        BOOTSTRAP_USER_ID,
        TaskCreate(column_id=COLUMN_TODO_ID, category_id=uncategorized_id, title="Files", due_date=today),
    )
    files = {"file": ("note.txt", BytesIO(b"hello attachment"), "text/plain")}
    response = client.post(f"/api/v1/tasks/{created.id}/attachments", files=files)
    assert response.status_code == 201, response.text
    attachment = response.json()
    assert attachment["original_name"] == "note.txt"
    assert attachment["attachment_kind"] == "file"

    download = client.get(f"/api/v1/tasks/{created.id}/attachments/{attachment['id']}/download")
    assert download.status_code == 200
    assert download.content == b"hello attachment"

    deleted = client.delete(f"/api/v1/tasks/{created.id}/attachments/{attachment['id']}")
    assert deleted.status_code == 204
    get_settings.cache_clear()


def test_attachment_rejects_path_traversal_name(
    client: TestClient,
    db: Session,
    today: date,
    uncategorized_id,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path))
    get_settings.cache_clear()

    created = task_service.create_task(
        db,
        BOOTSTRAP_USER_ID,
        TaskCreate(column_id=COLUMN_TODO_ID, category_id=uncategorized_id, title="Safe", due_date=today),
    )
    files = {"file": ("../../etc/passwd.txt", BytesIO(b"nope"), "text/plain")}
    response = client.post(f"/api/v1/tasks/{created.id}/attachments", files=files)
    assert response.status_code == 201
    body = response.json()
    assert body["original_name"] == "passwd.txt"
    assert ".." not in body.get("download_url", "")
    get_settings.cache_clear()


def test_delete_task_cleans_attachments(
    client: TestClient,
    db: Session,
    today: date,
    uncategorized_id,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path))
    get_settings.cache_clear()

    created = task_service.create_task(
        db,
        BOOTSTRAP_USER_ID,
        TaskCreate(column_id=COLUMN_TODO_ID, category_id=uncategorized_id, title="Cleanup", due_date=today),
    )
    files = {"file": ("a.txt", BytesIO(b"x"), "text/plain")}
    client.post(f"/api/v1/tasks/{created.id}/attachments", files=files).json()
    assert list(tmp_path.iterdir())

    response = client.delete(f"/api/v1/tasks/{created.id}")
    assert response.status_code == 204
    assert list(tmp_path.iterdir()) == []
    assert db.get(Task, created.id) is None
    get_settings.cache_clear()
