from __future__ import annotations

from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.constants import BOOTSTRAP_USER_ID, DEFAULT_BOARD_ID
from app.models import Task, TaskSubtask
from app.schemas.task import SubtaskCreate, SubtaskReorder, SubtaskUpdate
from app.services import subtask_service, task_service


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

    subtask_service.delete_subtask(db, BOOTSTRAP_USER_ID, parent.id, first.id)
    leftover = list(
        db.scalars(select(TaskSubtask).where(TaskSubtask.task_id == parent.id).order_by(TaskSubtask.position)).all()
    )
    assert [item.title for item in leftover] == ["Ship", "Review final copy"]
    assert [item.position for item in leftover] == [0, 1]


def test_deleting_parent_cascades_subtasks(
    db: Session,
    seed_tasks: list[Task],
    today: date,
) -> None:
    parent = seed_tasks[2]
    created = subtask_service.create_subtask(db, BOOTSTRAP_USER_ID, parent.id, SubtaskCreate(title="Nested work"))
    task_service.delete_task(db, BOOTSTRAP_USER_ID, parent.id)
    leftover = db.get(TaskSubtask, created.id)
    assert leftover is None


def test_subtask_http_api_and_summary_progress(
    client: TestClient,
    db: Session,
    seed_tasks: list[Task],
) -> None:
    parent = seed_tasks[0]
    created = client.post(f"/api/v1/tasks/{parent.id}/subtasks", json={"title": "Outline"})
    assert created.status_code == 201, created.text
    subtask_id = created.json()["id"]

    second = client.post(f"/api/v1/tasks/{parent.id}/subtasks", json={"title": "Draft"})
    assert second.status_code == 201
    second_id = second.json()["id"]

    patched = client.patch(
        f"/api/v1/tasks/{parent.id}/subtasks/{subtask_id}",
        json={"is_completed": True},
    )
    assert patched.status_code == 200
    assert patched.json()["is_completed"] is True

    renamed = client.patch(
        f"/api/v1/tasks/{parent.id}/subtasks/{second_id}",
        json={"title": "Draft v2"},
    )
    assert renamed.json()["title"] == "Draft v2"

    reordered = client.patch(
        f"/api/v1/tasks/{parent.id}/subtasks/reorder",
        json={"subtask_id": second_id, "after_subtask_id": None, "before_subtask_id": subtask_id},
    )
    assert reordered.status_code == 200, reordered.text
    assert [item["title"] for item in reordered.json()] == ["Draft v2", "Outline"]

    view = client.get(
        f"/api/v1/boards/{DEFAULT_BOARD_ID}/view",
        params={"unbounded": True, "date_field": "due_date"},
    )
    assert view.status_code == 200
    card = next(
        task
        for column in view.json()["columns"]
        for task in column["tasks"]
        if task["id"] == str(parent.id)
    )
    assert card["subtask_total"] == 2
    assert card["subtask_completed"] == 1

    deleted = client.delete(f"/api/v1/tasks/{parent.id}/subtasks/{subtask_id}")
    assert deleted.status_code == 204
