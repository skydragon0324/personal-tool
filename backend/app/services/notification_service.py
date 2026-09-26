"""In-app notifications: daily digest, schedule start reminders and per-task reminders.

Notifications are materialized lazily: every feed request runs ``sync_notifications`` for the
user, which inserts whatever is due right now. Each notification has a per-user ``dedupe_key``
and inserts use ``ON CONFLICT DO NOTHING``, so syncing is idempotent and safe to run from
several tabs at once.
"""

from __future__ import annotations

import math
import uuid
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models import (
    Board,
    BoardColumn,
    Notification,
    NotificationPreference,
    ScheduleEntry,
    ScheduleOccurrenceState,
    Task,
    User,
)
from app.schemas.notification import (
    NotificationFeed,
    NotificationPreferencesRead,
    NotificationPreferencesUpdate,
    NotificationRead,
)
from app.services.ownership import task_focus, task_notice_recipient
from app.services.schedule_occurrence_service import entry_occurs_on

DAILY_DIGEST = "daily_digest"
SCHEDULE_START = "schedule_start"
TASK_REMINDER = "task_reminder"
BOARD_SHARED = "board_shared"
TASK_ASSIGNED = "task_assigned"
TASK_OVERDUE = "task_overdue"
# Notices about a task that the user acts on (remind later, complete, close).
TASK_ALERT_KINDS = (TASK_REMINDER, TASK_OVERDUE)

FEED_LIMIT = 50
RETENTION = timedelta(days=30)
# A reminder is still delivered if the app was closed when it came due, but not days later.
REMINDER_LOOKBACK = timedelta(hours=24)
# A schedule start notice is still useful for a few minutes after the entry began.
SCHEDULE_GRACE = timedelta(minutes=5)


def _zone(timezone_name: str | None) -> ZoneInfo:
    try:
        return ZoneInfo(timezone_name or "UTC")
    except Exception:
        return ZoneInfo("UTC")


def _short_date(day: date) -> str:
    return f"{day.strftime('%b')} {day.day}"


def _clock(value: time) -> str:
    return value.strftime("%H:%M")


def get_preferences(db: Session, user_id: uuid.UUID) -> NotificationPreference:
    prefs = db.get(NotificationPreference, user_id)
    if prefs is None:
        db.execute(
            insert(NotificationPreference)
            .values(user_id=user_id)
            .on_conflict_do_nothing(index_elements=["user_id"])
        )
        db.flush()
        prefs = db.get(NotificationPreference, user_id)
    assert prefs is not None
    return prefs


def in_quiet_hours(prefs: NotificationPreference, local_time: time) -> bool:
    if not prefs.quiet_hours_enabled or prefs.quiet_start == prefs.quiet_end:
        return False
    if prefs.quiet_start < prefs.quiet_end:
        return prefs.quiet_start <= local_time < prefs.quiet_end
    # Window wraps past midnight, e.g. 22:00 -> 07:00.
    return local_time >= prefs.quiet_start or local_time < prefs.quiet_end


def _task_reminder_rows(
    db: Session, user_id: uuid.UUID, zone: ZoneInfo, now: datetime
) -> list[dict]:
    rows = db.execute(
        select(Task, Board.id)
        .join(BoardColumn, BoardColumn.id == Task.column_id)
        .join(Board, Board.id == BoardColumn.board_id)
        .where(
            # An assigned task reminds its assignees; an unassigned one reminds the board owner.
            task_notice_recipient(user_id),
            Board.archived_at.is_(None),
            BoardColumn.archived_at.is_(None),
            BoardColumn.is_done.is_(False),
            Task.completed_at.is_(None),
            Task.remind_at.is_not(None),
            Task.remind_at <= now,
            Task.remind_at > now - REMINDER_LOOKBACK,
        )
    ).all()
    today = now.astimezone(zone).date()
    values: list[dict] = []
    for task, board_id in rows:
        assert task.remind_at is not None
        if task.due_date < today:
            body = f"Overdue since {_short_date(task.due_date)}"
        elif task.due_date == today:
            body = "Due today"
        else:
            body = f"Due {_short_date(task.due_date)}"
        values.append(
            {
                "kind": TASK_REMINDER,
                "title": task.title[:200],
                "body": body,
                "board_id": board_id,
                "task_id": task.id,
                "dedupe_key": f"{TASK_REMINDER}:{task.id}:{int(task.remind_at.timestamp())}",
                "fire_at": task.remind_at,
            }
        )
    return values


def _overdue_rows(db: Session, user_id: uuid.UUID, zone: ZoneInfo, now: datetime) -> list[dict]:
    """One notice per unfinished task whose due date has passed.

    The dedupe key includes the due date: closing the notice silences that task until its due
    date changes, and moving the due date later and missing it again raises a fresh notice.
    """
    today = now.astimezone(zone).date()
    rows = db.execute(
        select(Task.id, Task.title, Task.due_date, Board.id)
        .join(BoardColumn, BoardColumn.id == Task.column_id)
        .join(Board, Board.id == BoardColumn.board_id)
        .where(
            task_notice_recipient(user_id),
            Board.archived_at.is_(None),
            BoardColumn.archived_at.is_(None),
            BoardColumn.is_done.is_(False),
            Task.completed_at.is_(None),
            Task.due_date < today,
        )
    ).all()
    values: list[dict] = []
    for task_id, title, due_date, board_id in rows:
        days = (today - due_date).days
        values.append(
            {
                "kind": TASK_OVERDUE,
                "title": title[:200],
                "body": f"Not finished · was due {_short_date(due_date)}"
                + (f" ({days} days ago)" if days > 1 else " (yesterday)"),
                "board_id": board_id,
                "task_id": task_id,
                "dedupe_key": f"{TASK_OVERDUE}:{task_id}:{due_date.isoformat()}",
                "fire_at": datetime.combine(due_date + timedelta(days=1), time.min, tzinfo=zone),
            }
        )
    return values


def _hide_resolved_overdue(
    db: Session, user_id: uuid.UUID, still_overdue: set[uuid.UUID], now: datetime
) -> None:
    """Hide overdue notices for tasks that were finished or rescheduled in the meantime."""
    query = update(Notification).where(
        Notification.user_id == user_id,
        Notification.kind == TASK_OVERDUE,
        Notification.dismissed_at.is_(None),
    )
    if still_overdue:
        query = query.where(Notification.task_id.not_in(still_overdue))
    db.execute(query.values(dismissed_at=now))


def _schedule_rows(
    db: Session,
    user_id: uuid.UUID,
    prefs: NotificationPreference,
    zone: ZoneInfo,
    now: datetime,
) -> list[dict]:
    entries = list(db.scalars(select(ScheduleEntry).where(ScheduleEntry.user_id == user_id)).all())
    if not entries:
        return []
    lead = timedelta(minutes=prefs.schedule_lead_minutes)
    local_today = now.astimezone(zone).date()
    # Tomorrow matters when the lead window crosses midnight (e.g. a 00:05 entry).
    days = (local_today, local_today + timedelta(days=1))
    completed = {
        (row.schedule_entry_id, row.occurrence_date)
        for row in db.scalars(
            select(ScheduleOccurrenceState).where(
                ScheduleOccurrenceState.user_id == user_id,
                ScheduleOccurrenceState.occurrence_date.in_(days),
                ScheduleOccurrenceState.is_completed.is_(True),
            )
        ).all()
    }
    values: list[dict] = []
    for day in days:
        for entry in entries:
            if not entry_occurs_on(entry, day) or (entry.id, day) in completed:
                continue
            starts_at = datetime.combine(day, entry.start_time, tzinfo=zone)
            if not (starts_at - lead <= now <= starts_at + SCHEDULE_GRACE):
                continue
            minutes = math.ceil((starts_at - now).total_seconds() / 60)
            when = f"in {minutes} min" if minutes > 0 else "now"
            values.append(
                {
                    "kind": SCHEDULE_START,
                    "title": entry.title[:200],
                    "body": f"Starts {when} · {_clock(entry.start_time)}–{_clock(entry.end_time)}",
                    "schedule_entry_id": entry.id,
                    "dedupe_key": f"{SCHEDULE_START}:{entry.id}:{day.isoformat()}",
                    "fire_at": starts_at - lead,
                }
            )
    return values


def _digest_row(
    db: Session,
    user: User,
    prefs: NotificationPreference,
    zone: ZoneInfo,
    now: datetime,
) -> dict | None:
    local_now = now.astimezone(zone)
    if local_now.time() < prefs.digest_time:
        return None
    today = local_now.date()
    dedupe_key = f"{DAILY_DIGEST}:{today.isoformat()}"
    exists = db.scalar(
        select(Notification.id).where(
            Notification.user_id == user.id, Notification.dedupe_key == dedupe_key
        )
    )
    if exists is not None:
        return None

    # Recurring tasks are generated on demand; make sure today's occurrences exist before counting.
    from app.services.recurrence_service import fill_user_series

    fill_user_series(db, user.id, start=today, end=today)
    db.flush()

    open_task = (
        select(func.count(Task.id))
        .join(BoardColumn, BoardColumn.id == Task.column_id)
        .join(Board, Board.id == BoardColumn.board_id)
        .where(
            task_focus(user.id),
            Board.archived_at.is_(None),
            BoardColumn.archived_at.is_(None),
            BoardColumn.is_done.is_(False),
            Task.completed_at.is_(None),
        )
    )
    due_today = int(db.scalar(open_task.where(Task.due_date == today)) or 0)
    overdue = int(db.scalar(open_task.where(Task.due_date < today)) or 0)
    entries = db.scalars(select(ScheduleEntry).where(ScheduleEntry.user_id == user.id)).all()
    scheduled = sum(1 for entry in entries if entry_occurs_on(entry, today))

    parts = []
    if due_today:
        parts.append(f"{due_today} task{'s' if due_today != 1 else ''} due today")
    if overdue:
        parts.append(f"{overdue} overdue")
    if scheduled:
        parts.append(f"{scheduled} scheduled")
    fire_at = datetime.combine(today, prefs.digest_time, tzinfo=zone)
    row = {
        "kind": DAILY_DIGEST,
        "title": "Your day at a glance",
        "body": " · ".join(parts),
        "dedupe_key": dedupe_key,
        "fire_at": fire_at,
    }
    if not parts:
        # Nothing to report: store a hidden row so the day is marked as handled.
        row["body"] = "Nothing due today"
        row["dismissed_at"] = now
    return row


def sync_notifications(db: Session, user: User, now: datetime | None = None) -> None:
    now = now or datetime.now(UTC)
    prefs = get_preferences(db, user.id)
    zone = _zone(user.timezone)

    db.execute(
        delete(Notification).where(
            Notification.user_id == user.id,
            Notification.created_at < now - RETENTION,
            # Kept while the task exists so a closed overdue notice does not come back.
            Notification.kind != TASK_OVERDUE,
        )
    )
    if in_quiet_hours(prefs, now.astimezone(zone).time()):
        db.commit()
        return

    rows: list[dict] = []
    if prefs.task_reminders_enabled:
        rows.extend(_task_reminder_rows(db, user.id, zone, now))
    if prefs.overdue_enabled:
        overdue = _overdue_rows(db, user.id, zone, now)
        rows.extend(overdue)
        _hide_resolved_overdue(db, user.id, {row["task_id"] for row in overdue}, now)
    if prefs.schedule_enabled:
        rows.extend(_schedule_rows(db, user.id, prefs, zone, now))
    if prefs.digest_enabled:
        digest = _digest_row(db, user, prefs, zone, now)
        if digest is not None:
            rows.append(digest)

    for row in rows:
        db.execute(
            insert(Notification)
            .values(id=uuid.uuid4(), user_id=user.id, created_at=now, **row)
            .on_conflict_do_nothing(constraint="uq_notifications_user_dedupe")
        )
    db.commit()


def get_feed(db: Session, user: User, now: datetime | None = None) -> NotificationFeed:
    now = now or datetime.now(UTC)
    sync_notifications(db, user, now)
    visible = (Notification.user_id == user.id, Notification.dismissed_at.is_(None))
    items = db.scalars(
        select(Notification)
        .where(*visible)
        .order_by(Notification.fire_at.desc(), Notification.created_at.desc())
        .limit(FEED_LIMIT)
    ).all()
    unread = db.scalar(
        select(func.count(Notification.id)).where(*visible, Notification.read_at.is_(None))
    )
    return NotificationFeed(
        items=[NotificationRead.model_validate(item) for item in items],
        unread_count=int(unread or 0),
        server_time=now,
    )


def _get_notification(db: Session, user_id: uuid.UUID, notification_id: uuid.UUID) -> Notification:
    item = db.scalar(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user_id,
            Notification.dismissed_at.is_(None),
        )
    )
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    return item


def mark_read(db: Session, user_id: uuid.UUID, notification_id: uuid.UUID) -> NotificationRead:
    item = _get_notification(db, user_id, notification_id)
    if item.read_at is None:
        item.read_at = datetime.now(UTC)
        db.commit()
        db.refresh(item)
    return NotificationRead.model_validate(item)


def mark_all_read(db: Session, user_id: uuid.UUID) -> None:
    db.execute(
        update(Notification)
        .where(
            Notification.user_id == user_id,
            Notification.read_at.is_(None),
            Notification.dismissed_at.is_(None),
        )
        .values(read_at=datetime.now(UTC))
    )
    db.commit()


def dismiss(db: Session, user_id: uuid.UUID, notification_id: uuid.UUID) -> None:
    item = _get_notification(db, user_id, notification_id)
    item.dismissed_at = datetime.now(UTC)
    db.commit()


def dismiss_all(db: Session, user_id: uuid.UUID) -> None:
    db.execute(
        update(Notification)
        .where(Notification.user_id == user_id, Notification.dismissed_at.is_(None))
        .values(dismissed_at=datetime.now(UTC))
    )
    db.commit()


def _notify_event(db: Session, user_id: uuid.UUID, kind: str, subject_id: uuid.UUID, **values) -> None:
    """Record a one-off event notification (not generated from a schedule). Caller commits."""
    now = datetime.now(UTC)
    db.execute(
        insert(Notification)
        .values(
            id=uuid.uuid4(),
            user_id=user_id,
            kind=kind,
            dedupe_key=f"{kind}:{subject_id}:{now.timestamp()}",
            fire_at=now,
            created_at=now,
            **values,
        )
        .on_conflict_do_nothing(constraint="uq_notifications_user_dedupe")
    )


def notify_board_shared(db: Session, user_id: uuid.UUID, board: Board, inviter_name: str) -> None:
    _notify_event(
        db,
        user_id,
        BOARD_SHARED,
        board.id,
        title=board.name[:200],
        body=f"{inviter_name} added you to this board",
        board_id=board.id,
    )


def notify_task_assigned(
    db: Session, assignee_id: uuid.UUID, task: Task, board_id: uuid.UUID, assigner_name: str
) -> None:
    _notify_event(
        db,
        assignee_id,
        TASK_ASSIGNED,
        task.id,
        title=task.title[:200],
        body=f"{assigner_name} assigned this task to you · Due {_short_date(task.due_date)}",
        board_id=board_id,
        task_id=task.id,
    )


def _task_notification(db: Session, user_id: uuid.UUID, notification_id: uuid.UUID) -> Notification:
    item = _get_notification(db, user_id, notification_id)
    if item.task_id is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="This notification is not about a task",
        )
    return item


def snooze(db: Session, user_id: uuid.UUID, notification_id: uuid.UUID, remind_at: datetime) -> None:
    """Remind me later: set the task's reminder time and hide this notice until then."""
    from app.services.ownership import get_task_for_user
    from app.services.task_service import _set_remind_at

    item = _task_notification(db, user_id, notification_id)
    if remind_at <= datetime.now(UTC):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Pick a time in the future",
        )
    task = get_task_for_user(db, user_id, item.task_id, for_update=True)
    # A snooze always schedules a new reminder, even if the same time was set before.
    task.remind_at = None
    _set_remind_at(db, task, remind_at)
    task.updated_at = datetime.now(UTC)
    item.dismissed_at = item.dismissed_at or datetime.now(UTC)
    item.read_at = item.read_at or datetime.now(UTC)
    db.commit()


def complete_task(db: Session, user_id: uuid.UUID, notification_id: uuid.UUID) -> None:
    """Move the notification's task to its board's first completed status."""
    from app.schemas.task import TaskMove
    from app.services.ownership import get_task_for_user
    from app.services.task_ordering_service import move_task

    item = _task_notification(db, user_id, notification_id)
    task = get_task_for_user(db, user_id, item.task_id)
    board_id = db.scalar(select(BoardColumn.board_id).where(BoardColumn.id == task.column_id))
    done = db.scalar(
        select(BoardColumn)
        .where(
            BoardColumn.board_id == board_id,
            BoardColumn.is_done.is_(True),
            BoardColumn.archived_at.is_(None),
        )
        .order_by(BoardColumn.position)
        .limit(1)
    )
    if done is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="This board has no completed status to move the task to",
        )
    if task.column_id != done.id:
        # move_task commits and hides the task's reminder and overdue notices.
        move_task(db, user_id, task.id, TaskMove(target_column_id=done.id, expected_version=task.version))
    item = _get_notification_any(db, user_id, notification_id)
    if item is not None and item.dismissed_at is None:
        item.dismissed_at = datetime.now(UTC)
    db.commit()


def _get_notification_any(db: Session, user_id: uuid.UUID, notification_id: uuid.UUID) -> Notification | None:
    return db.scalar(
        select(Notification).where(Notification.id == notification_id, Notification.user_id == user_id)
    )


def dismiss_task_notifications(db: Session, task_id: uuid.UUID) -> None:
    """Hide reminder and overdue notices for a task that was completed or rescheduled. Caller commits."""
    db.execute(
        update(Notification)
        .where(
            Notification.task_id == task_id,
            Notification.kind.in_(TASK_ALERT_KINDS),
            Notification.dismissed_at.is_(None),
        )
        .values(dismissed_at=datetime.now(UTC))
    )


def dismiss_schedule_notification(db: Session, entry_id: uuid.UUID, occurrence_date: date) -> None:
    """Hide the start notice for a schedule occurrence that was marked done. Caller commits."""
    db.execute(
        update(Notification)
        .where(
            Notification.schedule_entry_id == entry_id,
            Notification.dedupe_key == f"{SCHEDULE_START}:{entry_id}:{occurrence_date.isoformat()}",
            Notification.dismissed_at.is_(None),
        )
        .values(dismissed_at=datetime.now(UTC))
    )


def read_preferences(db: Session, user_id: uuid.UUID) -> NotificationPreferencesRead:
    prefs = get_preferences(db, user_id)
    db.commit()
    return NotificationPreferencesRead.model_validate(prefs)


def update_preferences(
    db: Session, user_id: uuid.UUID, payload: NotificationPreferencesUpdate
) -> NotificationPreferencesRead:
    prefs = get_preferences(db, user_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        if value is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"{key} cannot be null",
            )
        setattr(prefs, key, value)
    prefs.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(prefs)
    return NotificationPreferencesRead.model_validate(prefs)
