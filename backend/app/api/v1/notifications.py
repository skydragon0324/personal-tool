from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.db.session import get_db
from app.schemas.notification import (
    NotificationFeed,
    NotificationPreferencesRead,
    NotificationPreferencesUpdate,
    NotificationRead,
    NotificationSnooze,
)
from app.services import notification_service

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=NotificationFeed)
def get_feed(user: CurrentUser, db: Session = Depends(get_db)) -> NotificationFeed:
    """Generate any notifications that are now due, then return the latest ones."""
    return notification_service.get_feed(db, user)


@router.get("/preferences", response_model=NotificationPreferencesRead)
def get_preferences(user: CurrentUser, db: Session = Depends(get_db)) -> NotificationPreferencesRead:
    return notification_service.read_preferences(db, user.id)


@router.patch("/preferences", response_model=NotificationPreferencesRead)
def update_preferences(
    payload: NotificationPreferencesUpdate,
    user: CurrentUser,
    db: Session = Depends(get_db),
) -> NotificationPreferencesRead:
    return notification_service.update_preferences(db, user.id, payload)


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
def mark_all_read(user: CurrentUser, db: Session = Depends(get_db)) -> Response:
    notification_service.mark_all_read(db, user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{notification_id}/read", response_model=NotificationRead)
def mark_read(notification_id: UUID, user: CurrentUser, db: Session = Depends(get_db)) -> NotificationRead:
    return notification_service.mark_read(db, user.id, notification_id)


@router.post("/{notification_id}/snooze", status_code=status.HTTP_204_NO_CONTENT)
def snooze(
    notification_id: UUID, payload: NotificationSnooze, user: CurrentUser, db: Session = Depends(get_db)
) -> Response:
    """Remind me about this task again at `remind_at` and hide the notice until then."""
    notification_service.snooze(db, user.id, notification_id, payload.remind_at)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{notification_id}/complete-task", status_code=status.HTTP_204_NO_CONTENT)
def complete_task(notification_id: UUID, user: CurrentUser, db: Session = Depends(get_db)) -> Response:
    """Mark the notification's task as done (moves it to the board's completed status)."""
    notification_service.complete_task(db, user.id, notification_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def dismiss_all(user: CurrentUser, db: Session = Depends(get_db)) -> Response:
    notification_service.dismiss_all(db, user.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
def dismiss(notification_id: UUID, user: CurrentUser, db: Session = Depends(get_db)) -> Response:
    notification_service.dismiss(db, user.id, notification_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
