from __future__ import annotations

from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.constants import (
    BOOTSTRAP_USER_ID,
    COLUMN_DONE_ID,
    COLUMN_IN_PROGRESS_ID,
    COLUMN_TODO_ID,
    DEFAULT_BOARD_ID,
)
from app.models import Task
from app.schemas.task import SubtaskCreate, SubtaskReorder, SubtaskUpdate
from app.services import subtask_service, task_service


def _column_positions(db: Session, column_id) -> list[int]:
    db.expire_all()
    return list(
        db.scalars(select(Task.position).where(Task.column_id == column_id).order_by(Task.position)).all()
    )


def _visible_task_ids(client: TestClient) -> set[str]:
    view = client.get(
        f"/api/v1/boards/{DEFAULT_BOARD_ID}/view",
        params={"unbounded": True, "date_field": "due_date"},
    )
    assert view.status_code == 200, view.text
    return {task["id"] for column in view.json()["columns"] for task in column["tasks"]}


def test_subtask_crud_reorder_and_progress(
    client: TestClient,
    db: Session,
    seed_tasks: list[Task],
) -> None:
    parent = seed_tasks[0]
    first = subtask_service.create_subtask(db, BOOTSTRAP_USER_ID, parent.id, SubtaskCreate(title="Sketch"))
    second = subtask_service.create_subtask(db, BOOTSTRAP_USER_ID, parent.id, SubtaskCreate(title="Review copy"))
    third = subtask_service.create_subtask(db, BOOTSTRAP_USER_ID, parent.id, SubtaskCreate(title="Ship"))
    assert [first.position, second.position, third.position] == [0, 1, 2]

    updated = subtask_service.update_subtask(
        db,
        BOOTSTRAP_USER_ID,
        parent.id,
        first.id,
        SubtaskUpdate(is_completed=True),
    )
    assert updated.is_completed is True

    renamed = subtask_service.update_subtask(
        db,
        BOOTSTRAP_USER_ID,
        parent.id,
        second.id,
        SubtaskUpdate(title="Review final copy"),
    )
    assert renamed.title == "Review final copy"

    reordered = subtask_service.reorder_subtasks(
        db,
        BOOTSTRAP_USER_ID,
        parent.id,
        SubtaskReorder(subtask_id=third.id, after_subtask_id=None, before_subtask_id=first.id),
    )
    assert [item.title for item in reordered] == ["Ship", "Sketch", "Review final copy"]
    assert [item.position for item in reordered] == [0, 1, 2]

    detail = client.get(f"/api/v1/tasks/{parent.id}")
    assert detail.status_code == 200
    body = detail.json()
    assert [item["title"] for item in body["subtasks"]] == ["Ship", "Sketch", "Review final copy"]
    assert sum(1 for item in body["subtasks"] if item["is_completed"]) == 1
    assert body["parent"] is None

    subtask_service.delete_subtask(db, BOOTSTRAP_USER_ID, parent.id, first.id)
    leftover = subtask_service.list_subtasks(db, BOOTSTRAP_USER_ID, parent.id)
    assert [item.title for item in leftover] == ["Ship", "Review final copy"]
    assert db.get(Task, first.id) is None


def test_subtask_is_a_full_task_hidden_from_lists(
    client: TestClient,
    db: Session,
    seed_tasks: list[Task],
    today: date,
) -> None:
    parent = seed_tasks[0]
    created = client.post(f"/api/v1/tasks/{parent.id}/subtasks", json={"title": "Write intro"})
    assert created.status_code == 201, created.text
    child = created.json()
    # Starts in the parent's status with the parent's dates.
    assert child["column_id"] == str(COLUMN_TODO_ID)
    assert child["due_date"] == parent.due_date.isoformat()

    # Edited like any task, through the normal task endpoints.
    patched = client.patch(
        f"/api/v1/tasks/{child['id']}",
        json={
            "title": "Write the intro",
            "priority": "high",
            "content": {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Hi"}]}]},
            "links": [{"label": "Spec", "url": "https://example.com/spec", "position": 0}],
        },
    )
    assert patched.status_code == 200, patched.text
    detail = client.get(f"/api/v1/tasks/{child['id']}").json()
    assert detail["title"] == "Write the intro"
    assert detail["priority"] == "high"
    assert detail["content_text"] == "Hi"
    assert detail["links"][0]["label"] == "Spec"
    assert detail["parent"] == {"id": str(parent.id), "title": parent.title}

    # A sub-task cannot repeat or have its own sub-tasks.
    repeat = client.patch(
        f"/api/v1/tasks/{child['id']}",
        json={"recurrence": {"freq": "daily", "interval": 1}},
    )
    assert repeat.status_code == 422
    nested = client.post(f"/api/v1/tasks/{child['id']}/subtasks", json={"title": "Too deep"})
    assert nested.status_code == 422

    # Hidden from the board, Today and the dashboard task list; the parent stays.
    visible = _visible_task_ids(client)
    assert str(parent.id) in visible
    assert child["id"] not in visible
    todays = client.get("/api/v1/today", params={"date": today.isoformat()}).json()
    today_ids = {item["id"] for item in todays["active_tasks"] + todays["overdue_tasks"]}
    assert str(parent.id) in today_ids
    assert child["id"] not in today_ids
    rows = client.get("/api/v1/dashboard/tasks", params={"state": "all"}).json()["items"]
    assert child["id"] not in {row["id"] for row in rows}
    parent_row = next(row for row in rows if row["id"] == str(parent.id))
    assert parent_row["subtask_total"] == 1


def test_ticking_a_subtask_moves_it_between_open_and_done_statuses(
    client: TestClient,
    db: Session,
    seed_tasks: list[Task],
) -> None:
    parent = seed_tasks[0]
    child_id = client.post(f"/api/v1/tasks/{parent.id}/subtasks", json={"title": "Outline"}).json()["id"]

    done = client.patch(f"/api/v1/tasks/{parent.id}/subtasks/{child_id}", json={"is_completed": True})
    assert done.status_code == 200, done.text
    assert done.json()["is_completed"] is True
    assert done.json()["column_id"] == str(COLUMN_DONE_ID)
    assert done.json()["completed_at"] is not None

    reopened = client.patch(f"/api/v1/tasks/{parent.id}/subtasks/{child_id}", json={"is_completed": False})
    assert reopened.json()["is_completed"] is False
    # Back to the parent's (open) status.
    assert reopened.json()["column_id"] == str(COLUMN_TODO_ID)

    # Column positions stay dense through the moves.
    for column_id in (COLUMN_TODO_ID, COLUMN_IN_PROGRESS_ID, COLUMN_DONE_ID):
        positions = _column_positions(db, column_id)
        assert positions == list(range(len(positions)))

    card = next(
        task
        for column in client.get(
            f"/api/v1/boards/{DEFAULT_BOARD_ID}/view",
            params={"unbounded": True, "date_field": "due_date"},
        ).json()["columns"]
        for task in column["tasks"]
        if task["id"] == str(parent.id)
    )
    assert (card["subtask_total"], card["subtask_completed"]) == (1, 0)


def test_deleting_parent_removes_subtasks_and_closes_column_gaps(
    db: Session,
    seed_tasks: list[Task],
) -> None:
    parent = seed_tasks[2]
    created = subtask_service.create_subtask(db, BOOTSTRAP_USER_ID, parent.id, SubtaskCreate(title="Nested work"))
    subtask_service.update_subtask(
        db, BOOTSTRAP_USER_ID, parent.id, created.id, SubtaskUpdate(is_completed=True)
    )
    task_service.delete_task(db, BOOTSTRAP_USER_ID, parent.id)
    db.expire_all()
    assert db.get(Task, created.id) is None
    for column_id in (COLUMN_TODO_ID, COLUMN_IN_PROGRESS_ID, COLUMN_DONE_ID):
        positions = _column_positions(db, column_id)
        assert positions == list(range(len(positions)))


def test_duplicate_copies_subtasks_as_tasks(
    client: TestClient,
    db: Session,
    seed_tasks: list[Task],
) -> None:
    parent = seed_tasks[0]
    client.post(f"/api/v1/tasks/{parent.id}/subtasks", json={"title": "One"})
    client.post(f"/api/v1/tasks/{parent.id}/subtasks", json={"title": "Two"})

    copy = client.post(f"/api/v1/tasks/{parent.id}/duplicate")
    assert copy.status_code == 201, copy.text
    assert [item["title"] for item in copy.json()["subtasks"]] == ["One", "Two"]
    original_ids = {item["id"] for item in client.get(f"/api/v1/tasks/{parent.id}").json()["subtasks"]}
    assert original_ids.isdisjoint({item["id"] for item in copy.json()["subtasks"]})


def test_subtask_cannot_move_to_another_board_on_its_own(
    client: TestClient,
    seed_tasks: list[Task],
) -> None:
    parent = seed_tasks[0]
    child_id = client.post(f"/api/v1/tasks/{parent.id}/subtasks", json={"title": "Outline"}).json()["id"]
    moved = client.post(
        f"/api/v1/tasks/{child_id}/move-to-board",
        json={"board_id": str(DEFAULT_BOARD_ID)},
    )
    assert moved.status_code == 422
    assert "parent" in moved.json()["detail"]


def test_deleting_a_repeating_task_series_removes_occurrence_subtasks(
    client: TestClient,
    db: Session,
    seed_tasks: list[Task],
    today: date,
) -> None:
    created = client.post(
        "/api/v1/tasks",
        json={
            "column_id": str(COLUMN_TODO_ID),
            "category_id": str(seed_tasks[0].category_id),
            "title": "Water plants",
            "start_date": today.isoformat(),
            "due_date": today.isoformat(),
            "recurrence": {"freq": "daily", "interval": 1},
        },
    )
    assert created.status_code == 201, created.text
    occurrence = created.json()
    child_id = client.post(
        f"/api/v1/tasks/{occurrence['id']}/subtasks", json={"title": "Fill the can"}
    ).json()["id"]

    deleted = client.delete(f"/api/v1/tasks/{occurrence['id']}", params={"delete_scope": "series"})
    assert deleted.status_code == 204, deleted.text
    db.expire_all()
    assert db.get(Task, child_id) is None
    positions = _column_positions(db, COLUMN_TODO_ID)
    assert positions == list(range(len(positions)))
