from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.tests.auth_helpers import bind_client, register_user


def _plan(client: TestClient, name: str = "Learning Plan") -> dict:
    response = client.post("/api/v1/plans", json={"name": name})
    assert response.status_code == 201, response.text
    return response.json()


def _day(client: TestClient, plan_id: str, day: str) -> dict:
    response = client.post(f"/api/v1/plans/{plan_id}/days", json={"day": day})
    assert response.status_code == 201, response.text
    return response.json()


def _item(client: TestClient, day_id: str, title: str) -> dict:
    response = client.post(f"/api/v1/plan-days/{day_id}/items", json={"title": title})
    assert response.status_code == 201, response.text
    return response.json()


def test_plan_crud_and_list_counts(client: TestClient) -> None:
    learning = _plan(client, "  Learning Plan  ")
    assert learning["name"] == "Learning Plan"
    assert learning["days"] == []
    fitness = _plan(client, "Fitness Plan")

    renamed = client.patch(f"/api/v1/plans/{fitness['id']}", json={"name": "Gym Plan"})
    assert renamed.status_code == 200, renamed.text
    assert renamed.json()["name"] == "Gym Plan"

    day = _day(client, learning["id"], "2026-09-23")
    _item(client, day["id"], "Study React")
    done = _item(client, day["id"], "Read 20 pages")
    client.patch(f"/api/v1/plan-items/{done['id']}", json={"is_completed": True})

    plans = client.get("/api/v1/plans").json()
    assert [plan["name"] for plan in plans] == ["Learning Plan", "Gym Plan"]
    assert plans[0]["day_count"] == 1
    assert plans[0]["item_count"] == 2
    assert plans[0]["completed_count"] == 1
    assert plans[0]["first_day"] == "2026-09-23"
    assert plans[1]["item_count"] == 0

    assert client.delete(f"/api/v1/plans/{learning['id']}").status_code == 204
    assert client.get(f"/api/v1/plans/{learning['id']}").status_code == 404
    assert [plan["name"] for plan in client.get("/api/v1/plans").json()] == ["Gym Plan"]


def test_days_are_sorted_by_date_and_unique_per_plan(client: TestClient) -> None:
    plan = _plan(client)
    _day(client, plan["id"], "2026-09-25")
    _day(client, plan["id"], "2026-09-23")
    duplicate = client.post(f"/api/v1/plans/{plan['id']}/days", json={"day": "2026-09-23"})
    assert duplicate.status_code == 409

    # The same date is fine in a different plan.
    other = _plan(client, "Fitness Plan")
    _day(client, other["id"], "2026-09-23")

    detail = client.get(f"/api/v1/plans/{plan['id']}").json()
    assert [day["day"] for day in detail["days"]] == ["2026-09-23", "2026-09-25"]

    moved = client.patch(f"/api/v1/plan-days/{detail['days'][1]['id']}", json={"day": "2026-09-23"})
    assert moved.status_code == 409
    moved = client.patch(
        f"/api/v1/plan-days/{detail['days'][1]['id']}", json={"day": "2026-09-24", "title": "Redux"}
    )
    assert moved.status_code == 200, moved.text
    assert moved.json()["title"] == "Redux"


def test_items_keep_order_and_persist_completion(client: TestClient) -> None:
    plan = _plan(client)
    day = _day(client, plan["id"], "2026-09-23")
    first = _item(client, day["id"], "Study React for 1 hour")
    second = _item(client, day["id"], "Practice TypeScript")

    checked = client.patch(f"/api/v1/plan-items/{second['id']}", json={"is_completed": True})
    assert checked.status_code == 200, checked.text
    assert checked.json()["is_completed"] is True
    assert checked.json()["completed_at"] is not None

    items = client.get(f"/api/v1/plans/{plan['id']}").json()["days"][0]["items"]
    assert [(item["title"], item["is_completed"]) for item in items] == [
        ("Study React for 1 hour", False),
        ("Practice TypeScript", True),
    ]

    unchecked = client.patch(f"/api/v1/plan-items/{second['id']}", json={"is_completed": False})
    assert unchecked.json()["is_completed"] is False
    assert unchecked.json()["completed_at"] is None

    renamed = client.patch(f"/api/v1/plan-items/{first['id']}", json={"title": "Study React"})
    assert renamed.json()["title"] == "Study React"
    assert client.patch(f"/api/v1/plan-items/{first['id']}", json={"title": "  "}).status_code == 422

    assert client.delete(f"/api/v1/plan-items/{first['id']}").status_code == 204
    assert client.delete(f"/api/v1/plan-days/{day['id']}").status_code == 204
    assert client.get(f"/api/v1/plans/{plan['id']}").json()["days"] == []


def test_validation(client: TestClient) -> None:
    assert client.post("/api/v1/plans", json={"name": "   "}).status_code == 422
    plan = _plan(client)
    assert client.post(f"/api/v1/plans/{plan['id']}/days", json={"day": "not-a-date"}).status_code == 422
    day = _day(client, plan["id"], "2026-09-23")
    assert client.post(f"/api/v1/plan-days/{day['id']}/items", json={"title": ""}).status_code == 422


def test_other_user_cannot_see_or_change_plans(client: TestClient, db: Session) -> None:
    plan = _plan(client)
    day = _day(client, plan["id"], "2026-09-23")
    item = _item(client, day["id"], "Private item")

    outsider = bind_client(db)
    register_user(outsider, email="plans-outsider@example.com")
    assert outsider.get("/api/v1/plans").json() == []
    assert outsider.get(f"/api/v1/plans/{plan['id']}").status_code == 404
    assert outsider.patch(f"/api/v1/plans/{plan['id']}", json={"name": "Mine"}).status_code == 404
    assert outsider.delete(f"/api/v1/plans/{plan['id']}").status_code == 404
    assert outsider.post(f"/api/v1/plans/{plan['id']}/days", json={"day": "2026-09-24"}).status_code == 404
    assert outsider.patch(f"/api/v1/plan-days/{day['id']}", json={"title": "x"}).status_code == 404
    assert outsider.post(f"/api/v1/plan-days/{day['id']}/items", json={"title": "x"}).status_code == 404
    assert outsider.patch(f"/api/v1/plan-items/{item['id']}", json={"is_completed": True}).status_code == 404
    assert outsider.delete(f"/api/v1/plan-items/{item['id']}").status_code == 404
    app.dependency_overrides.clear()


def test_plans_require_auth(anonymous_client: TestClient) -> None:
    assert anonymous_client.get("/api/v1/plans").status_code == 401


def test_overview_reports_state_today_timeline_and_missed_days(client: TestClient) -> None:
    today = "2026-09-23"
    learning = _plan(client, "Learning Plan")
    past = _day(client, learning["id"], "2026-09-21")
    now = _day(client, learning["id"], today)
    _day(client, learning["id"], "2026-09-25")
    done_item = _item(client, past["id"], "Read chapter 1")
    _item(client, past["id"], "Take notes")
    client.patch(f"/api/v1/plan-items/{done_item['id']}", json={"is_completed": True})
    today_item = _item(client, now["id"], "Practice TypeScript")
    client.patch(f"/api/v1/plan-items/{today_item['id']}", json={"is_completed": True})
    _item(client, now["id"], "Review notes")

    trip = _plan(client, "Vacation Plan")
    _day(client, trip["id"], "2026-10-10")
    _plan(client, "Someday")

    response = client.get("/api/v1/plans/overview", params={"today": today})
    assert response.status_code == 200, response.text
    data = response.json()

    totals = data["totals"]
    assert totals["plans"] == 3 and totals["active_plans"] == 1
    assert totals["items"] == 4 and totals["completed"] == 2 and totals["completion_rate"] == 0.5
    assert totals["today_total"] == 2 and totals["today_completed"] == 1
    assert totals["missed_items"] == 1

    states = {plan["name"]: plan["state"] for plan in data["plans"]}
    assert states == {"Learning Plan": "active", "Vacation Plan": "upcoming", "Someday": "empty"}
    learning_row = next(plan for plan in data["plans"] if plan["name"] == "Learning Plan")
    assert learning_row["days_done"] == 2 and learning_row["days_left"] == 1
    assert learning_row["next_day"] == today

    assert {item["title"] for item in data["today_items"]} == {"Practice TypeScript", "Review notes"}
    assert [(entry["day"], entry["open_items"]) for entry in data["behind"]] == [("2026-09-21", 1)]

    points = {point["day"]: (point["planned"], point["completed"]) for point in data["timeline"]}
    assert points["2026-09-21"] == (2, 1)
    assert points[today] == (2, 1)
    assert len(data["timeline"]) == 20


def test_overview_requires_today_and_is_private(client: TestClient, db: Session) -> None:
    assert client.get("/api/v1/plans/overview").status_code == 422
    _plan(client, "Mine")
    outsider = bind_client(db)
    register_user(outsider, email="plans-overview-outsider@example.com")
    assert outsider.get("/api/v1/plans/overview", params={"today": "2026-09-23"}).json()["totals"]["plans"] == 0
    app.dependency_overrides.clear()
