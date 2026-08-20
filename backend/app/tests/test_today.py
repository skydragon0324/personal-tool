from __future__ import annotations

from datetime import date, timedelta
from uuid import UUID, uuid4

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.constants import DEFAULT_BOARD_ID
from app.main import app
from app.models import ScheduleOccurrenceState
from app.tests.auth_helpers import bind_client, register_user


SELECTED = date(2026, 8, 20)  # Thursday
WEEK_START = date(2026, 8, 17)


def _todo_and_category(client: TestClient) -> tuple[str, str]:
    columns = client.get(f"/api/v1/boards/{DEFAULT_BOARD_ID}/columns").json()
    todo = next(item["id"] for item in columns if item["name"] == "To Do")
    category = client.get(f"/api/v1/boards/{DEFAULT_BOARD_ID}/categories").json()[0]["id"]
    return todo, category


def _create_task(
    client: TestClient,
    *,
    title: str,
    start: date,
    due: date,
    column_id: str | None = None,
    category_id: str | None = None,
) -> dict:
    if column_id is None or category_id is None:
        column_id, category_id = _todo_and_category(client)
    response = client.post(
        "/api/v1/tasks",
        json={
            "column_id": column_id,
            "category_id": category_id,
            "title": title,
            "start_date": start.isoformat(),
            "due_date": due.isoformat(),
            "priority": "high",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_today_includes_inclusive_date_boundaries(client: TestClient) -> None:
    starts_today = _create_task(client, title="Starts today", start=SELECTED, due=SELECTED + timedelta(days=3))
    due_today = _create_task(client, title="Due today", start=SELECTED - timedelta(days=3), due=SELECTED)
    spanning = _create_task(client, title="Spanning", start=SELECTED - timedelta(days=1), due=SELECTED + timedelta(days=1))
    outside = _create_task(client, title="Outside", start=SELECTED + timedelta(days=1), due=SELECTED + timedelta(days=2))
    earlier = _create_task(client, title="Ended yesterday", start=SELECTED - timedelta(days=5), due=SELECTED - timedelta(days=1))

    body = client.get("/api/v1/today", params={"date": SELECTED.isoformat()}).json()
    titles = {item["title"] for item in body["tasks"]}
    assert starts_today["title"] in titles
    assert due_today["title"] in titles
    assert spanning["title"] in titles
    assert outside["title"] not in titles
    assert earlier["title"] not in titles
    assert body["date"] == SELECTED.isoformat()


def test_today_includes_completed_tasks_and_excludes_archived_boards(
    client: TestClient, db: Session, uncategorized_id
) -> None:
    done_columns = client.get(f"/api/v1/boards/{DEFAULT_BOARD_ID}/columns").json()
    done_id = next(item["id"] for item in done_columns if item["name"] == "Done")
    category_id = client.get(f"/api/v1/boards/{DEFAULT_BOARD_ID}/categories").json()[0]["id"]
    finished = _create_task(
        client,
        title="Finished today",
        start=SELECTED,
        due=SELECTED,
        column_id=done_id,
        category_id=category_id,
    )

    extra = client.post("/api/v1/boards", json={"name": f"Archive-{uuid4().hex[:8]}", "timezone": "UTC"})
    assert extra.status_code == 201, extra.text
    board_id = extra.json()["id"]
    column_id = client.get(f"/api/v1/boards/{board_id}/columns").json()[0]["id"]
    cat_id = client.get(f"/api/v1/boards/{board_id}/categories").json()[0]["id"]
    hidden = _create_task(
        client,
        title="Archived board task",
        start=SELECTED,
        due=SELECTED,
        column_id=column_id,
        category_id=cat_id,
    )
    assert client.post(f"/api/v1/boards/{board_id}/archive").status_code == 200

    body = client.get("/api/v1/today", params={"date": SELECTED.isoformat()}).json()
    titles = {item["title"] for item in body["tasks"]}
    assert finished["title"] in titles
    assert hidden["title"] not in titles
    completed = next(item for item in body["tasks"] if item["id"] == finished["id"])
    assert completed["status_is_done"] is True
    assert completed["deadline_status"] == "completed"
    assert body["task_progress"]["total"] >= 1
    assert body["task_progress"]["completed"] >= 1


def test_today_schedule_routine_and_this_week(client: TestClient) -> None:
    routine = client.post(
        "/api/v1/schedule",
        json={
            "title": "Thursday standup",
            "kind": "routine",
            "weekdays": [3],
            "start_time": "09:00:00",
            "end_time": "09:30:00",
            "color": "teal",
        },
    )
    assert routine.status_code == 201, routine.text
    this_week = client.post(
        "/api/v1/schedule",
        json={
            "title": "Thursday review",
            "kind": "this_week",
            "weekdays": [3],
            "week_start": WEEK_START.isoformat(),
            "start_time": "11:00:00",
            "end_time": "12:00:00",
            "color": "blue",
        },
    )
    assert this_week.status_code == 201, this_week.text
    other_day = client.post(
        "/api/v1/schedule",
        json={
            "title": "Friday only",
            "kind": "routine",
            "weekdays": [4],
            "start_time": "10:00:00",
            "end_time": "10:30:00",
        },
    )
    assert other_day.status_code == 201, other_day.text
    next_week = client.post(
        "/api/v1/schedule",
        json={
            "title": "Next week only",
            "kind": "this_week",
            "weekdays": [3],
            "week_start": (WEEK_START + timedelta(days=7)).isoformat(),
            "start_time": "13:00:00",
            "end_time": "14:00:00",
        },
    )
    assert next_week.status_code == 201, next_week.text

    body = client.get("/api/v1/today", params={"date": SELECTED.isoformat()}).json()
    titles = [item["title"] for item in body["schedules"]]
    assert titles == ["Thursday standup", "Thursday review"]
    assert body["schedule_progress"]["total"] == 2
    assert body["schedule_progress"]["completed"] == 0
    assert body["schedule_progress"]["percentage"] == 0.0


def test_schedule_occurrence_toggle_and_isolation(db: Session) -> None:
    first = bind_client(db)
    register_user(first, email="today-a@example.com")
    created = first.post(
        "/api/v1/schedule",
        json={
            "title": "Private block",
            "kind": "routine",
            "weekdays": [3],
            "start_time": "08:00:00",
            "end_time": "08:30:00",
        },
    )
    assert created.status_code == 201, created.text
    entry_id = created.json()["id"]
    completed = first.put(
        f"/api/v1/schedule/{entry_id}/occurrences/{SELECTED.isoformat()}",
        json={"is_completed": True},
    )
    assert completed.status_code == 200, completed.text
    assert completed.json()["is_completed"] is True
    assert completed.json()["completed_at"] is not None

    today = first.get("/api/v1/today", params={"date": SELECTED.isoformat()}).json()
    match = next(item for item in today["schedules"] if item["id"] == entry_id)
    assert match["is_completed"] is True
    assert today["schedule_progress"]["completed"] == 1

    invalid_day = first.put(
        f"/api/v1/schedule/{entry_id}/occurrences/2026-08-21",
        json={"is_completed": True},
    )
    assert invalid_day.status_code == 422

    second = bind_client(db)
    register_user(second, email="today-b@example.com")
    stolen = second.put(
        f"/api/v1/schedule/{entry_id}/occurrences/{SELECTED.isoformat()}",
        json={"is_completed": False},
    )
    assert stolen.status_code == 404
    other_today = second.get("/api/v1/today", params={"date": SELECTED.isoformat()}).json()
    assert entry_id not in {item["id"] for item in other_today["schedules"]}
    app.dependency_overrides.clear()


def test_today_pinned_notes_only_and_limit(client: TestClient) -> None:
    for index in range(8):
        pinned = client.post(
            "/api/v1/notes",
            json={"title": f"Pinned {index}", "body": f"line one\nline two\nline three {index}", "is_pinned": True},
        )
        assert pinned.status_code == 201, pinned.text
    unpinned = client.post("/api/v1/notes", json={"title": "Loose note", "body": "not pinned", "is_pinned": False})
    assert unpinned.status_code == 201, unpinned.text

    body = client.get("/api/v1/today", params={"date": SELECTED.isoformat()}).json()
    titles = [item["title"] for item in body["pinned_notes"]]
    assert "Loose note" not in titles
    assert all(item["is_pinned"] is True for item in client.get("/api/v1/notes", params={"pinned": True}).json())
    assert body["pinned_notes_total"] >= 8
    assert len(body["pinned_notes"]) == 6
    assert "\n" in body["pinned_notes"][0]["preview"] or body["pinned_notes"][0]["preview"]


def test_old_occurrence_states_are_pruned(client: TestClient, db: Session) -> None:
    created = client.post(
        "/api/v1/schedule",
        json={
            "title": "Daily leftover",
            "kind": "routine",
            "weekdays": [0, 1, 2, 3, 4, 5, 6],
            "start_time": "07:00:00",
            "end_time": "07:15:00",
        },
    )
    assert created.status_code == 201, created.text
    entry_id = created.json()["id"]
    last_week = SELECTED - timedelta(days=7)
    client.put(
        f"/api/v1/schedule/{entry_id}/occurrences/{last_week.isoformat()}",
        json={"is_completed": True},
    )
    assert (
        db.scalar(
            select(func.count())
            .select_from(ScheduleOccurrenceState)
            .where(ScheduleOccurrenceState.schedule_entry_id == UUID(entry_id))
        )
        == 1
    )

    assert client.get("/api/v1/today", params={"date": SELECTED.isoformat()}).status_code == 200
    leftover = db.scalar(
        select(func.count()).select_from(ScheduleOccurrenceState).where(
            ScheduleOccurrenceState.schedule_entry_id == UUID(entry_id),
            ScheduleOccurrenceState.occurrence_date == last_week,
        )
    )
    assert leftover == 0


def test_today_progress_is_zero_when_empty(client: TestClient) -> None:
    body = client.get("/api/v1/today", params={"date": "2025-01-01"}).json()
    assert body["task_progress"]["percentage"] == 0.0
    assert body["schedule_progress"]["percentage"] == 0.0
    assert body["task_progress"]["total"] == 0
    assert body["schedule_progress"]["total"] == 0
