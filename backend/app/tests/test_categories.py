from __future__ import annotations

from datetime import date
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.constants import COLUMN_TODO_ID, DEFAULT_BOARD_ID
from app.models import Board, Category, Task
from app.schemas.task import TaskCreate, TaskUpdate
from app.services import board_service, task_service
from app.services.content_utils import count_checklist_items
from app.services.url_validation import validate_http_url


def _extra_board(db: Session, name: str) -> Board:
    max_pos = db.scalar(select(func.coalesce(func.max(Board.position), -1)))
    board = Board(
        name=name,
        timezone="UTC",
        color="slate",
        position=int(max_pos) + 1,
    )
    db.add(board)
    db.flush()
    return board


def test_list_and_create_categories(client: TestClient, db: Session) -> None:
    listed = client.get(f"/api/v1/boards/{DEFAULT_BOARD_ID}/categories")
    assert listed.status_code == 200
    names = {item["name"] for item in listed.json()}
    assert "Uncategorized" in names

    created = client.post(
        f"/api/v1/boards/{DEFAULT_BOARD_ID}/categories",
        json={"name": f"  Personal {uuid4().hex[:8]}  ", "color": "teal"},
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["name"].startswith("Personal ")
    assert body["color"] == "teal"
    assert body["board_id"] == str(DEFAULT_BOARD_ID)

    listed_again = client.get(f"/api/v1/boards/{DEFAULT_BOARD_ID}/categories")
    assert any(item["id"] == body["id"] for item in listed_again.json())


def test_categories_are_isolated_by_board(client: TestClient, db: Session) -> None:
    other = _extra_board(db, "Other Board")
    other_cat = Category(board_id=other.id, name="Secret", color="pink", position=0)
    db.add(other_cat)
    db.commit()

    response = client.get(f"/api/v1/boards/{DEFAULT_BOARD_ID}/categories")
    assert response.status_code == 200
    names = {item["name"] for item in response.json()}
    assert "Secret" not in names


def test_duplicate_category_name_is_case_insensitive(client: TestClient) -> None:
    name = f"Work-{uuid4().hex[:8]}"
    first = client.post(
        f"/api/v1/boards/{DEFAULT_BOARD_ID}/categories",
        json={"name": name, "color": "blue"},
    )
    assert first.status_code == 201, first.text
    duplicate = client.post(
        f"/api/v1/boards/{DEFAULT_BOARD_ID}/categories",
        json={"name": name.lower(), "color": "red"},
    )
    assert duplicate.status_code == 409
    assert "already exists" in duplicate.json()["detail"].lower()


def test_cannot_assign_category_from_another_board(
    db: Session,
    today: date,
    uncategorized_id,
) -> None:
    other = _extra_board(db, "Foreign")
    foreign = Category(board_id=other.id, name="Personal", color="teal", position=0)
    db.add(foreign)
    db.commit()

    with pytest.raises(HTTPException) as exc:
        task_service.create_task(
            db,
            TaskCreate(
                column_id=COLUMN_TODO_ID,
                category_id=foreign.id,
                title="Wrong board",
                due_date=today,
            ),
        )
    assert exc.value.status_code == 422
    assert "same board" in exc.value.detail.lower()


def test_existing_tasks_are_linked_to_uncategorized(
    db: Session,
    seed_tasks: list[Task],
    uncategorized_id,
    today: date,
) -> None:
    assert all(task.category_id == uncategorized_id for task in seed_tasks)
    view = board_service.get_board_view(db, DEFAULT_BOARD_ID, legacy_date=today)
    summaries = [task for column in view.columns for task in column.tasks]
    assert summaries
    assert all(task.category.id == uncategorized_id for task in summaries)
    assert all(task.category.name == "Uncategorized" for task in summaries)
    assert all(task.category.color == "gray" for task in summaries)


def test_task_summary_and_detail_include_category(
    db: Session,
    today: date,
    uncategorized_id,
) -> None:
    created = task_service.create_task(
        db,
        TaskCreate(
            column_id=COLUMN_TODO_ID,
            category_id=uncategorized_id,
            title="Categorized",
            due_date=today,
        ),
    )
    assert created.category.id == uncategorized_id
    assert created.category.name == "Uncategorized"

    view = board_service.get_board_view(db, DEFAULT_BOARD_ID, legacy_date=today)
    match = next(task for column in view.columns for task in column.tasks if task.id == created.id)
    assert match.category.name == "Uncategorized"
    assert created.category.color == "gray"


def test_update_rejects_foreign_category(
    db: Session,
    today: date,
    uncategorized_id,
) -> None:
    task = task_service.create_task(
        db,
        TaskCreate(
            column_id=COLUMN_TODO_ID,
            category_id=uncategorized_id,
            title="Stay",
            due_date=today,
        ),
    )
    other = _extra_board(db, "Else")
    foreign = Category(board_id=other.id, name="Nope", color="red", position=0)
    db.add(foreign)
    db.commit()

    with pytest.raises(HTTPException) as exc:
        task_service.update_task(db, task.id, TaskUpdate(category_id=foreign.id))
    assert exc.value.status_code == 422


def test_unsafe_content_image_url_is_blocked(
    db: Session,
    today: date,
    uncategorized_id,
) -> None:
    content = {
        "type": "doc",
        "content": [
            {
                "type": "image",
                "attrs": {"src": "javascript:alert(1)", "alt": "bad"},
            }
        ],
    }
    with pytest.raises(HTTPException) as exc:
        task_service.create_task(
            db,
            TaskCreate(
                column_id=COLUMN_TODO_ID,
                category_id=uncategorized_id,
                title="Unsafe image",
                due_date=today,
                content=content,
            ),
        )
    assert exc.value.status_code == 422

    with pytest.raises(HTTPException):
        validate_http_url("blob:http://localhost/abc")
    with pytest.raises(HTTPException):
        validate_http_url("data:image/png;base64,abc")


def test_checklist_checked_state_is_persisted(
    db: Session,
    today: date,
    uncategorized_id,
) -> None:
    content = {
        "type": "doc",
        "content": [
            {
                "type": "taskList",
                "content": [
                    {
                        "type": "taskItem",
                        "attrs": {"checked": True},
                        "content": [
                            {"type": "paragraph", "content": [{"type": "text", "text": "Done"}]}
                        ],
                    }
                ],
            }
        ],
    }
    created = task_service.create_task(
        db,
        TaskCreate(
            column_id=COLUMN_TODO_ID,
            category_id=uncategorized_id,
            title="Checklist",
            due_date=today,
            content=content,
        ),
    )
    reloaded = task_service.get_task(db, created.id)
    done, total = count_checklist_items(reloaded.content)
    assert (done, total) == (1, 1)
    item = reloaded.content["content"][0]["content"][0]
    assert item["attrs"]["checked"] is True
