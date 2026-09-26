from __future__ import annotations

from datetime import UTC, date, datetime, time, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.main import app
from app.models import Notification, User
from app.services import notification_service
from app.tests.auth_helpers import TEST_OWNER_EMAIL, bind_client, register_user

DAY = date(2026, 9, 23)  # Wednesday


def _at(hour: int, minute: int = 0, day: date = DAY) -> datetime:
    return datetime.combine(day, time(hour, minute), tzinfo=UTC)


def _user(db: Session, email: str = TEST_OWNER_EMAIL) -> User:
    user = db.scalar(select(User).where(User.email == email))
    assert user is not None
    return user


def _board(client: TestClient) -> tuple[str, str, str, str]:
    board_id = client.get("/api/v1/boards").json()[0]["id"]
    columns = client.get(f"/api/v1/boards/{board_id}/columns").json()
    todo = next(item["id"] for item in columns if not item["is_done"])
    done = next(item["id"] for item in columns if item["is_done"])
    category = client.get(f"/api/v1/boards/{board_id}/categories").json()[0]["id"]
    return board_id, todo, done, category


def _task(client: TestClient, title: str, *, due: date = DAY, remind_at: datetime | None = None) -> dict:
    _board_id, todo, _done, category = _board(client)
    body: dict = {
        "column_id": todo,
        "category_id": category,
        "title": title,
        "start_date": due.isoformat(),
        "due_date": due.isoformat(),
    }
    if remind_at is not None:
        body["remind_at"] = remind_at.isoformat()
    response = client.post("/api/v1/tasks", json=body)
    assert response.status_code == 201, response.text
    return response.json()


def _visible(db: Session, user: User, kind: str | None = None) -> list[Notification]:
    query = select(Notification).where(
        Notification.user_id == user.id, Notification.dismissed_at.is_(None)
    )
    if kind:
        query = query.where(Notification.kind == kind)
    return list(db.scalars(query).all())


def _quiet_digest(db: Session, user: User) -> None:
    prefs = notification_service.get_preferences(db, user.id)
    prefs.digest_enabled = False
    db.commit()


def test_task_reminder_fires_once_when_due(client: TestClient, db: Session) -> None:
    user = _user(db)
    _quiet_digest(db, user)
    task = _task(client, "Call the bank", remind_at=_at(9))
    assert task["remind_at"] is not None

    notification_service.sync_notifications(db, user, _at(8, 59))
    assert _visible(db, user, "task_reminder") == []

    notification_service.sync_notifications(db, user, _at(9, 0))
    notification_service.sync_notifications(db, user, _at(9, 5))
    reminders = _visible(db, user, "task_reminder")
    assert len(reminders) == 1
    assert reminders[0].title == "Call the bank"
    assert reminders[0].body == "Due today"
    assert str(reminders[0].task_id) == task["id"]


def test_old_reminders_are_not_delivered_days_later(client: TestClient, db: Session) -> None:
    user = _user(db)
    _quiet_digest(db, user)
    _task(client, "Stale", remind_at=_at(9))
    notification_service.sync_notifications(db, user, _at(9) + timedelta(days=2))
    assert _visible(db, user, "task_reminder") == []


def test_completing_task_dismisses_reminder(client: TestClient, db: Session) -> None:
    user = _user(db)
    _quiet_digest(db, user)
    _board_id, _todo, done, _category = _board(client)
    task = _task(client, "Pay invoice", remind_at=_at(9))
    notification_service.sync_notifications(db, user, _at(9, 1))
    assert len(_visible(db, user, "task_reminder")) == 1

    moved = client.patch(
        f"/api/v1/tasks/{task['id']}/move",
        json={"target_column_id": done, "expected_version": task["version"]},
    )
    assert moved.status_code == 200, moved.text
    assert _visible(db, user, "task_reminder") == []
    notification_service.sync_notifications(db, user, _at(9, 2))
    assert _visible(db, user, "task_reminder") == []


def test_rescheduling_reminder_replaces_the_old_one(client: TestClient, db: Session) -> None:
    user = _user(db)
    _quiet_digest(db, user)
    task = _task(client, "Water plants", remind_at=_at(9))
    notification_service.sync_notifications(db, user, _at(9, 1))
    assert len(_visible(db, user, "task_reminder")) == 1

    patched = client.patch(f"/api/v1/tasks/{task['id']}", json={"remind_at": _at(15).isoformat()})
    assert patched.status_code == 200, patched.text
    assert _visible(db, user, "task_reminder") == []

    notification_service.sync_notifications(db, user, _at(15, 0))
    assert len(_visible(db, user, "task_reminder")) == 1

    cleared = client.patch(f"/api/v1/tasks/{task['id']}", json={"remind_at": None})
    assert cleared.status_code == 200, cleared.text
    assert cleared.json()["remind_at"] is None


def test_remind_at_requires_timezone_offset(client: TestClient) -> None:
    _board_id, todo, _done, category = _board(client)
    response = client.post(
        "/api/v1/tasks",
        json={
            "column_id": todo,
            "category_id": category,
            "title": "Naive",
            "due_date": DAY.isoformat(),
            "remind_at": "2026-09-23T09:00:00",
        },
    )
    assert response.status_code == 422


def test_reminder_on_recurring_task_stays_on_that_task(client: TestClient, db: Session) -> None:
    _board_id, todo, _done, category = _board(client)
    created = client.post(
        "/api/v1/tasks",
        json={
            "column_id": todo,
            "category_id": category,
            "title": "Weekly review",
            "start_date": DAY.isoformat(),
            "due_date": DAY.isoformat(),
            "recurrence": {"freq": "weekly", "weekdays": [2]},
            "remind_at": _at(9).isoformat(),
        },
    )
    assert created.status_code == 201, created.text
    first = created.json()
    assert first["remind_at"] is not None
    series_id = first["recurrence"]["series_id"]
    before = client.get(f"/api/v1/task-recurrence/{series_id}").json()

    patched = client.patch(
        f"/api/v1/tasks/{first['id']}",
        json={"remind_at": _at(10).isoformat(), "edit_scope": "series"},
    )
    assert patched.status_code == 200, patched.text
    assert patched.json()["remind_at"].startswith("2026-09-23T10:00")
    after = client.get(f"/api/v1/task-recurrence/{series_id}").json()
    assert after["version"] == before["version"]
    assert after["title"] == "Weekly review"


def test_schedule_start_notification_uses_lead_time(client: TestClient, db: Session) -> None:
    user = _user(db)
    _quiet_digest(db, user)
    entry = client.post(
        "/api/v1/schedule",
        json={
            "title": "Standup",
            "kind": "routine",
            "weekdays": [0, 1, 2, 3, 4, 5, 6],
            "start_time": "09:00:00",
            "end_time": "09:15:00",
            "color": "teal",
        },
    )
    assert entry.status_code == 201, entry.text
    entry_id = entry.json()["id"]

    notification_service.sync_notifications(db, user, _at(8, 49))
    assert _visible(db, user, "schedule_start") == []

    notification_service.sync_notifications(db, user, _at(8, 52))
    notification_service.sync_notifications(db, user, _at(8, 55))
    notices = _visible(db, user, "schedule_start")
    assert len(notices) == 1
    assert notices[0].title == "Standup"
    assert notices[0].body == "Starts in 8 min · 09:00–09:15"

    done = client.put(
        f"/api/v1/schedule/{entry_id}/occurrences/{DAY.isoformat()}",
        json={"is_completed": True},
    )
    assert done.status_code == 200, done.text
    assert _visible(db, user, "schedule_start") == []


def test_completed_schedule_occurrence_is_not_announced(client: TestClient, db: Session) -> None:
    user = _user(db)
    _quiet_digest(db, user)
    entry = client.post(
        "/api/v1/schedule",
        json={
            "title": "Gym",
            "kind": "routine",
            "weekdays": [2],
            "start_time": "18:00:00",
            "end_time": "19:00:00",
            "color": "teal",
        },
    ).json()
    done = client.put(
        f"/api/v1/schedule/{entry['id']}/occurrences/{DAY.isoformat()}",
        json={"is_completed": True},
    )
    assert done.status_code == 200, done.text
    notification_service.sync_notifications(db, user, _at(17, 55))
    assert _visible(db, user, "schedule_start") == []


def test_daily_digest_once_per_day_after_digest_time(client: TestClient, db: Session) -> None:
    user = _user(db)
    _task(client, "Due today A")
    _task(client, "Due today B")
    _task(client, "Late", due=DAY - timedelta(days=2))

    notification_service.sync_notifications(db, user, _at(7, 59))
    assert _visible(db, user, "daily_digest") == []

    notification_service.sync_notifications(db, user, _at(8, 0))
    notification_service.sync_notifications(db, user, _at(12, 0))
    digests = _visible(db, user, "daily_digest")
    assert len(digests) == 1
    assert digests[0].body.startswith("2 tasks due today · 1 overdue")


def test_empty_day_digest_is_hidden(client: TestClient, db: Session) -> None:
    user = _user(db)
    empty_day = date(2030, 1, 7)
    notification_service.sync_notifications(db, user, _at(9, day=empty_day))
    assert _visible(db, user, "daily_digest") == []
    stored = db.scalar(
        select(Notification).where(
            Notification.user_id == user.id,
            Notification.dedupe_key == f"daily_digest:{empty_day.isoformat()}",
        )
    )
    assert stored is not None and stored.dismissed_at is not None


def test_digest_uses_user_timezone(db: Session) -> None:
    client = bind_client(db)
    try:
        register_user(client, email="seoul@example.com", timezone="Asia/Seoul")
        user = _user(db, "seoul@example.com")
        _task(client, "Seoul task")
        # 07:30 / 08:30 in Seoul on DAY are 22:30 / 23:30 UTC the day before; the digest is at 08:00.
        notification_service.sync_notifications(db, user, _at(22, 30, DAY - timedelta(days=1)))
        assert _visible(db, user, "daily_digest") == []
        notification_service.sync_notifications(db, user, _at(23, 30, DAY - timedelta(days=1)))
        digests = _visible(db, user, "daily_digest")
        assert len(digests) == 1
        assert digests[0].dedupe_key == f"daily_digest:{DAY.isoformat()}"
    finally:
        app.dependency_overrides.clear()


def test_quiet_hours_hold_notifications_until_they_end(client: TestClient, db: Session) -> None:
    user = _user(db)
    prefs = notification_service.get_preferences(db, user.id)
    prefs.digest_enabled = False
    prefs.quiet_hours_enabled = True
    prefs.quiet_start = time(22, 0)
    prefs.quiet_end = time(7, 0)
    db.commit()
    _task(client, "Night reminder", remind_at=_at(23, 0, DAY - timedelta(days=1)))

    notification_service.sync_notifications(db, user, _at(23, 5, DAY - timedelta(days=1)))
    assert _visible(db, user, "task_reminder") == []
    notification_service.sync_notifications(db, user, _at(7, 5))
    assert len(_visible(db, user, "task_reminder")) == 1


def test_feed_read_and_dismiss_api(client: TestClient, db: Session) -> None:
    user = _user(db)
    _quiet_digest(db, user)
    now = datetime.now(UTC)
    _task(client, "Reminder one", due=now.date(), remind_at=now - timedelta(minutes=2))
    _task(client, "Reminder two", due=now.date(), remind_at=now - timedelta(minutes=1))

    feed = client.get("/api/v1/notifications")
    assert feed.status_code == 200, feed.text
    body = feed.json()
    assert body["unread_count"] == 2
    assert [item["title"] for item in body["items"]] == ["Reminder two", "Reminder one"]
    first_id = body["items"][0]["id"]

    read = client.post(f"/api/v1/notifications/{first_id}/read")
    assert read.status_code == 200, read.text
    assert read.json()["read_at"] is not None
    assert client.get("/api/v1/notifications").json()["unread_count"] == 1

    assert client.post("/api/v1/notifications/read-all").status_code == 204
    assert client.get("/api/v1/notifications").json()["unread_count"] == 0

    assert client.delete(f"/api/v1/notifications/{first_id}").status_code == 204
    remaining = client.get("/api/v1/notifications").json()["items"]
    assert [item["title"] for item in remaining] == ["Reminder one"]

    assert client.delete("/api/v1/notifications").status_code == 204
    assert client.get("/api/v1/notifications").json()["items"] == []


def test_preferences_api_validates(client: TestClient) -> None:
    prefs = client.get("/api/v1/notifications/preferences")
    assert prefs.status_code == 200, prefs.text
    assert prefs.json()["digest_time"] == "08:00:00"
    assert prefs.json()["schedule_lead_minutes"] == 10

    updated = client.patch(
        "/api/v1/notifications/preferences",
        json={"digest_time": "07:30", "schedule_lead_minutes": 5, "quiet_hours_enabled": True},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["digest_time"] == "07:30:00"
    assert updated.json()["schedule_lead_minutes"] == 5
    assert updated.json()["quiet_hours_enabled"] is True

    assert client.patch("/api/v1/notifications/preferences", json={"schedule_lead_minutes": 500}).status_code == 422
    assert client.patch("/api/v1/notifications/preferences", json={"digest_enabled": None}).status_code == 422


def test_other_user_cannot_touch_notifications(client: TestClient, db: Session) -> None:
    user = _user(db)
    _quiet_digest(db, user)
    now = datetime.now(UTC)
    _task(client, "Private reminder", due=now.date(), remind_at=now - timedelta(minutes=1))
    notification_id = client.get("/api/v1/notifications").json()["items"][0]["id"]

    outsider = bind_client(db)
    register_user(outsider, email="notif-outsider@example.com")
    assert all(
        item["title"] != "Private reminder"
        for item in outsider.get("/api/v1/notifications").json()["items"]
    )
    assert outsider.post(f"/api/v1/notifications/{notification_id}/read").status_code == 404
    assert outsider.delete(f"/api/v1/notifications/{notification_id}").status_code == 404
    app.dependency_overrides.clear()


def test_notifications_require_auth(anonymous_client: TestClient) -> None:
    assert anonymous_client.get("/api/v1/notifications").status_code == 401


def _overdue_setup(client: TestClient, db: Session) -> tuple[User, dict]:
    user = _user(db)
    _quiet_digest(db, user)
    task = _task(client, "Submit the report", due=DAY - timedelta(days=2))
    return user, task


def test_unfinished_task_past_due_gets_one_overdue_notice(client: TestClient, db: Session) -> None:
    user, task = _overdue_setup(client, db)
    _task(client, "Due today, not overdue yet")

    notification_service.sync_notifications(db, user, _at(9))
    notification_service.sync_notifications(db, user, _at(10))
    overdue = _visible(db, user, "task_overdue")
    assert [str(item.task_id) for item in overdue] == [
        task["id"]
    ]
    assert "was due" in overdue[0].body


def test_closing_overdue_notice_keeps_it_closed(client: TestClient, db: Session) -> None:
    user, _task_row = _overdue_setup(client, db)
    notification_service.sync_notifications(db, user, _at(9))
    notice = _visible(db, user, "task_overdue")[0]
    notification_service.dismiss(db, user.id, notice.id)

    # Even well past the normal 30-day retention it does not come back.
    notification_service.sync_notifications(db, user, _at(9) + timedelta(days=45))
    assert _visible(db, user, "task_overdue") == []


def test_snooze_turns_overdue_notice_into_a_reminder(client: TestClient, db: Session) -> None:
    user, task = _overdue_setup(client, db)
    notification_service.sync_notifications(db, user, _at(9))
    notice = _visible(db, user, "task_overdue")[0]

    remind_at = datetime.now(UTC) + timedelta(hours=1)
    response = client.post(
        f"/api/v1/notifications/{notice.id}/snooze", json={"remind_at": remind_at.isoformat()}
    )
    assert response.status_code == 204, response.text
    assert _visible(db, user, "task_overdue") == []
    detail = client.get(f"/api/v1/tasks/{task['id']}").json()
    assert detail["remind_at"] is not None

    notification_service.sync_notifications(db, user, remind_at + timedelta(minutes=1))
    assert len(_visible(db, user, "task_reminder")) == 1

    past = client.post(
        f"/api/v1/notifications/{notice.id}/snooze",
        json={"remind_at": (datetime.now(UTC) - timedelta(hours=1)).isoformat()},
    )
    assert past.status_code in (404, 422)


def test_complete_from_notice_moves_task_to_done(client: TestClient, db: Session) -> None:
    user, task = _overdue_setup(client, db)
    _board_id, _todo, done, _category = _board(client)
    notification_service.sync_notifications(db, user, _at(9))
    notice = _visible(db, user, "task_overdue")[0]

    response = client.post(f"/api/v1/notifications/{notice.id}/complete-task")
    assert response.status_code == 204, response.text
    detail = client.get(f"/api/v1/tasks/{task['id']}").json()
    assert detail["column_id"] == done
    assert detail["completed_at"] is not None
    assert _visible(db, user, "task_overdue") == []


def test_rescheduled_task_hides_overdue_notice(client: TestClient, db: Session) -> None:
    user, task = _overdue_setup(client, db)
    notification_service.sync_notifications(db, user, _at(9))
    assert len(_visible(db, user, "task_overdue")) == 1

    client.patch(f"/api/v1/tasks/{task['id']}", json={"due_date": (DAY + timedelta(days=3)).isoformat()})
    notification_service.sync_notifications(db, user, _at(10))
    assert _visible(db, user, "task_overdue") == []


def test_overdue_notices_can_be_turned_off(client: TestClient, db: Session) -> None:
    user, _task_row = _overdue_setup(client, db)
    response = client.patch("/api/v1/notifications/preferences", json={"overdue_enabled": False})
    assert response.status_code == 200 and response.json()["overdue_enabled"] is False
    notification_service.sync_notifications(db, user, _at(9))
    assert _visible(db, user, "task_overdue") == []
