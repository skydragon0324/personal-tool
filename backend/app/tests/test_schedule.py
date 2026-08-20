from __future__ import annotations

from datetime import date, timedelta
from uuid import uuid4

from fastapi.testclient import TestClient


def _monday(day: date) -> date:
    return day - timedelta(days=day.weekday())


def test_create_and_list_schedule_entries(client: TestClient) -> None:
    today = date(2026, 8, 19)
    week_start = _monday(today)
    routine = client.post(
        "/api/v1/schedule",
        json={
            "title": "Morning stretch",
            "kind": "routine",
            "weekdays": [0, 1, 2, 3, 4],
            "start_time": "07:00:00",
            "end_time": "07:30:00",
            "priority": "medium",
            "color": "teal",
            "notes": "Keep it light",
        },
    )
    assert routine.status_code == 201, routine.text
    assert routine.json()["week_start"] is None
    assert routine.json()["weekdays"] == [0, 1, 2, 3, 4]

    special = client.post(
        "/api/v1/schedule",
        json={
            "title": "Dentist",
            "kind": "this_week",
            "weekdays": [2],
            "week_start": week_start.isoformat(),
            "start_time": "10:00:00",
            "end_time": "11:00:00",
            "color": "blue",
        },
    )
    assert special.status_code == 201, special.text
    assert special.json()["week_start"] == week_start.isoformat()

    overlap = client.post(
        "/api/v1/schedule",
        json={
            "title": "Team sync",
            "kind": "this_week",
            "weekdays": [2],
            "week_start": week_start.isoformat(),
            "start_time": "10:30:00",
            "end_time": "11:30:00",
            "color": "orange",
        },
    )
    assert overlap.status_code == 201, overlap.text

    listed = client.get(
        "/api/v1/schedule",
        params={"week_start": week_start.isoformat(), "today": today.isoformat()},
    )
    assert listed.status_code == 200, listed.text
    titles = {item["title"] for item in listed.json()}
    assert titles == {"Morning stretch", "Dentist", "Team sync"}


def test_past_this_week_entries_are_hidden(client: TestClient) -> None:
    today = date(2026, 8, 19)
    past_monday = _monday(today) - timedelta(days=7)
    created = client.post(
        "/api/v1/schedule",
        json={
            "title": "Old meeting",
            "kind": "this_week",
            "weekdays": [1],
            "week_start": past_monday.isoformat(),
            "start_time": "09:00:00",
            "end_time": "10:00:00",
        },
    )
    assert created.status_code == 201, created.text
    listed = client.get(
        "/api/v1/schedule",
        params={"week_start": past_monday.isoformat(), "today": today.isoformat()},
    )
    assert listed.status_code == 200
    assert listed.json() == []


def test_schedule_rejects_invalid_times_and_missing_week_start(client: TestClient) -> None:
    invalid_time = client.post(
        "/api/v1/schedule",
        json={
            "title": "Backwards",
            "kind": "routine",
            "weekdays": [0],
            "start_time": "11:00:00",
            "end_time": "10:00:00",
        },
    )
    assert invalid_time.status_code == 422

    missing_week = client.post(
        "/api/v1/schedule",
        json={
            "title": "No week",
            "kind": "this_week",
            "weekdays": [0],
            "start_time": "09:00:00",
            "end_time": "10:00:00",
        },
    )
    assert missing_week.status_code == 422


def test_update_and_delete_schedule_entry(client: TestClient) -> None:
    today = date(2026, 8, 19)
    created = client.post(
        "/api/v1/schedule",
        json={
            "title": "Draft block",
            "kind": "routine",
            "weekdays": [6],
            "start_time": "18:00:00",
            "end_time": "19:00:00",
            "priority": "low",
        },
    ).json()
    entry_id = created["id"]
    patched = client.patch(
        f"/api/v1/schedule/{entry_id}",
        json={"title": "Evening walk", "end_time": "19:30:00", "priority": "high"},
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["title"] == "Evening walk"
    assert patched.json()["end_time"] == "19:30:00"
    assert patched.json()["priority"] == "high"

    deleted = client.delete(f"/api/v1/schedule/{entry_id}")
    assert deleted.status_code == 204
    week_start = _monday(today)
    listed = client.get(
        "/api/v1/schedule",
        params={"week_start": week_start.isoformat(), "today": today.isoformat()},
    )
    assert entry_id not in {item["id"] for item in listed.json()}
    assert client.get(f"/api/v1/schedule/{entry_id}").status_code == 404
    assert client.patch(f"/api/v1/schedule/{uuid4()}", json={"title": "Nope"}).status_code == 404
