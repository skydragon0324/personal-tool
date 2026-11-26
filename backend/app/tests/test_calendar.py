from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.models import BoardColumn
from app.services import calendar_service
from app.tests.auth_helpers import bind_client, register_user

# A month far from today, so other fixtures' tasks never land in the range.
MARCH_START = date(2031, 3, 1)
MARCH_END = date(2031, 3, 31)


def _board(client: TestClient) -> tuple[str, str, str, str]:
    board_id = next(item["id"] for item in client.get("/api/v1/boards").json() if item["role"] == "owner")
    columns = client.get(f"/api/v1/boards/{board_id}/columns").json()
    todo = next(item["id"] for item in columns if not item["is_done"])
    done = next(item["id"] for item in columns if item["is_done"])
    category = client.get(f"/api/v1/boards/{board_id}/categories").json()[0]["id"]
    return board_id, todo, done, category


def _new_board(client: TestClient, name: str) -> tuple[str, str, str]:
    response = client.post("/api/v1/boards", json={"name": name, "timezone": "UTC"})
    assert response.status_code == 201, response.text
    board_id = response.json()["id"]
    columns = client.get(f"/api/v1/boards/{board_id}/columns").json()
    todo = next(item["id"] for item in columns if not item["is_done"])
    category = client.get(f"/api/v1/boards/{board_id}/categories").json()[0]["id"]
    return board_id, todo, category


def _task(client: TestClient, column: str, category: str, title: str, due: date, **extra) -> dict:
    response = client.post(
        "/api/v1/tasks",
        json={
            "column_id": column,
            "category_id": category,
            "title": title,
            "start_date": (extra.pop("start", None) or due).isoformat(),
            "due_date": due.isoformat(),
            **extra,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def _calendar(client: TestClient, start: date = MARCH_START, end: date = MARCH_END, **params):
    return client.get(
        "/api/v1/calendar/tasks",
        params={"start_date": start.isoformat(), "end_date": end.isoformat(), **params},
    )


def _titles(response) -> list[str]:
    assert response.status_code == 200, response.text
    return [item["title"] for item in response.json()["items"]]


@pytest.fixture()
def mate(client: TestClient, db: Session):
    other = bind_client(db)
    register_user(other, login_id="mate", display_name="Mate")
    try:
        yield other
    finally:
        app.dependency_overrides.clear()


def test_returns_tasks_due_inside_the_range_including_both_ends(client: TestClient) -> None:
    board_id, todo, done, category = _board(client)
    _task(client, todo, category, "Day before", MARCH_START - timedelta(days=1))
    first = _task(client, todo, category, "First day", MARCH_START, priority="high")
    _task(client, done, category, "Last day", MARCH_END)
    _task(client, todo, category, "Day after", MARCH_END + timedelta(days=1))
    # Starts before the range but is due inside it: shown on its due day.
    _task(client, todo, category, "Long task", MARCH_START + timedelta(days=3), start=MARCH_START - timedelta(days=10))

    response = _calendar(client)
    assert _titles(response) == ["First day", "Long task", "Last day"]
    body = response.json()
    assert body["truncated"] is False
    assert body["start_date"] == MARCH_START.isoformat()
    assert body["end_date"] == MARCH_END.isoformat()
    item = body["items"][0]
    assert item["id"] == first["id"]
    assert item["board_id"] == board_id
    assert item["board_name"]
    assert item["board_color"]
    assert item["status_name"]
    assert item["priority"] == "high"
    assert item["is_done"] is False
    assert "is_recurring" not in item
    assert body["items"][2]["is_done"] is True
    # Only what the calendar needs: no rich-text content.
    assert "content" not in item and "description" not in item


def test_single_day_range(client: TestClient) -> None:
    _, todo, _, category = _board(client)
    _task(client, todo, category, "Only day", MARCH_START)
    _task(client, todo, category, "Next day", MARCH_START + timedelta(days=1))
    assert _titles(_calendar(client, MARCH_START, MARCH_START)) == ["Only day"]


def test_filters_by_board(client: TestClient) -> None:
    _, todo, _, category = _board(client)
    other_id, other_todo, other_category = _new_board(client, "Calendar other")
    _task(client, todo, category, "Home task", MARCH_START)
    _task(client, other_todo, other_category, "Other task", MARCH_START)
    assert sorted(_titles(_calendar(client))) == ["Home task", "Other task"]
    assert _titles(_calendar(client, board_id=other_id)) == ["Other task"]


def test_shows_shared_boards_but_not_other_peoples_boards(client: TestClient, mate: TestClient) -> None:
    board_id, todo, _, category = _board(client)
    _task(client, todo, category, "Owner task", MARCH_START)
    mate_board, mate_todo, _, mate_category = _board(mate)
    _task(mate, mate_todo, mate_category, "Private mate task", MARCH_START)

    assert _titles(_calendar(client)) == ["Owner task"]
    assert _titles(_calendar(mate)) == ["Private mate task"]
    # Someone else's board id is not found rather than silently empty.
    assert _calendar(client, board_id=mate_board).status_code == 404

    shared = client.post(f"/api/v1/boards/{board_id}/members", json={"login_id": "mate"})
    assert shared.status_code == 201, shared.text
    assert sorted(_titles(_calendar(mate))) == ["Owner task", "Private mate task"]
    assert _titles(_calendar(mate, board_id=board_id)) == ["Owner task"]


def test_leaves_out_archived_boards_archived_statuses_and_subtasks(client: TestClient, db: Session) -> None:
    _, todo, _, category = _board(client)
    parent = _task(client, todo, category, "Parent", MARCH_START)
    sub = client.post(f"/api/v1/tasks/{parent['id']}/subtasks", json={"title": "Sub"})
    assert sub.status_code == 201, sub.text

    archived_board, archived_todo, archived_category = _new_board(client, "Calendar archived")
    _task(client, archived_todo, archived_category, "On archived board", MARCH_START)
    assert client.post(f"/api/v1/boards/{archived_board}/archive").status_code == 200

    # The API empties a status before archiving it, so archive one that still holds a task directly
    # (as older data can have).
    _, status_todo, status_category = _new_board(client, "Calendar statuses")
    _task(client, status_todo, status_category, "In archived status", MARCH_START)
    column = db.get(BoardColumn, UUID(status_todo))
    assert column is not None
    column.archived_at = datetime.now(UTC)
    db.commit()

    titles = _titles(_calendar(client))
    assert "In archived status" not in titles
    assert "Parent" in titles
    assert "Sub" not in titles
    assert "On archived board" not in titles
    assert _calendar(client, board_id=archived_board).json()["items"] == []


def test_reports_truncation(client: TestClient) -> None:
    _, todo, _, category = _board(client)
    for index in range(4):
        _task(client, todo, category, f"Task {index}", MARCH_START + timedelta(days=index))
    limited = _calendar(client, limit=3)
    assert _titles(limited) == ["Task 0", "Task 1", "Task 2"]
    assert limited.json()["truncated"] is True
    assert limited.json()["limit"] == 3
    exact = _calendar(client, limit=4)
    assert exact.json()["truncated"] is False


@pytest.mark.parametrize(
    ("params", "code"),
    [
        ({"start_date": "2031-03-10", "end_date": "2031-03-01"}, "end_before_start"),
        ({"start_date": "2031-01-01", "end_date": "2031-03-31"}, "date_range_too_long"),
    ],
)
def test_rejects_invalid_ranges(client: TestClient, params: dict, code: str) -> None:
    response = client.get("/api/v1/calendar/tasks", params=params)
    assert response.status_code == 422
    assert response.json()["code"] == code


def test_range_limits_and_required_dates(client: TestClient) -> None:
    longest = MARCH_START + timedelta(days=calendar_service.CALENDAR_MAX_RANGE_DAYS - 1)
    assert _calendar(client, MARCH_START, longest).status_code == 200
    assert _calendar(client, MARCH_START, longest + timedelta(days=1)).status_code == 422
    assert client.get("/api/v1/calendar/tasks", params={"start_date": "2031-03-01"}).status_code == 422
    assert client.get("/api/v1/calendar/tasks", params={"start_date": "x", "end_date": "y"}).status_code == 422
    assert _calendar(client, limit=0).status_code == 422
    assert _calendar(client, limit=calendar_service.CALENDAR_MAX_LIMIT + 1).status_code == 422


def test_requires_sign_in(anonymous_client: TestClient) -> None:
    response = anonymous_client.get(
        "/api/v1/calendar/tasks",
        params={"start_date": MARCH_START.isoformat(), "end_date": MARCH_END.isoformat()},
    )
    assert response.status_code == 401
