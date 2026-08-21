from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models import Board, BoardColumn, Task, TaskLink, TaskSubtask, User
from app.models.task_recurrence import (
    TaskRecurrenceException,
    TaskRecurrenceLinkTemplate,
    TaskRecurrenceSeries,
    TaskRecurrenceSubtaskTemplate,
)
from app.schemas.recurrence import RecurrenceGenerateResult, RecurrenceInput, RecurrenceSeriesRead
from app.schemas.task import TaskCreate, TaskDetailRead, TaskLinkInput, TaskUpdate
from app.services.board_service import get_column_or_404
from app.services.category_service import ensure_category_on_board
from app.services.content_utils import extract_text_from_content, uncheck_checklist, validate_content_urls
from app.services.ownership import get_task_for_user
from app.services.recurrence_dates import list_occurrence_dates, occurrence_index_for
from app.services.storage import get_storage
from app.services.task_serializers import to_detail

HORIZON_DAYS = 62
MAX_GENERATE_DAYS = 92
NEXT_SEARCH_YEARS = 5


def calendar_today(timezone_name: str | None) -> date:
    try:
        zone = ZoneInfo(timezone_name or "UTC")
    except Exception:
        zone = ZoneInfo("UTC")
    return datetime.now(zone).date()


def get_series_for_user(db: Session, user_id: uuid.UUID, series_id: uuid.UUID) -> TaskRecurrenceSeries:
    series = db.scalar(
        select(TaskRecurrenceSeries)
        .where(TaskRecurrenceSeries.id == series_id, TaskRecurrenceSeries.user_id == user_id)
        .options(
            selectinload(TaskRecurrenceSeries.link_templates),
            selectinload(TaskRecurrenceSeries.subtask_templates),
            selectinload(TaskRecurrenceSeries.exceptions),
        )
    )
    if series is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recurrence series not found")
    return series


def read_series(db: Session, user_id: uuid.UUID, series_id: uuid.UUID) -> RecurrenceSeriesRead:
    series = get_series_for_user(db, user_id, series_id)
    open_count = db.scalar(
        select(func.count())
        .select_from(Task)
        .join(BoardColumn, BoardColumn.id == Task.column_id)
        .where(
            Task.recurrence_series_id == series.id,
            Task.completed_at.is_(None),
            BoardColumn.is_done.is_(False),
        )
    )
    completed_count = db.scalar(
        select(func.count())
        .select_from(Task)
        .where(Task.recurrence_series_id == series.id, Task.completed_at.is_not(None))
    )
    return RecurrenceSeriesRead(
        id=series.id,
        board_id=series.board_id,
        default_column_id=series.default_column_id,
        category_id=series.category_id,
        title=series.title,
        priority=series.priority,
        duration_days=series.duration_days,
        timezone=series.timezone,
        freq=series.freq,  # type: ignore[arg-type]
        interval=series.interval,
        weekdays=list(series.weekdays or []),
        month_day=series.month_day,
        until_date=series.until_date,
        occurrence_limit=series.occurrence_limit,
        status=series.status,  # type: ignore[arg-type]
        dtstart=series.dtstart,
        generated_through=series.generated_through,
        open_count=int(open_count or 0),
        completed_count=int(completed_count or 0),
    )


def stop_series(db: Session, user_id: uuid.UUID, series_id: uuid.UUID) -> RecurrenceSeriesRead:
    series = get_series_for_user(db, user_id, series_id)
    series.status = "stopped"
    series.updated_at = datetime.now(UTC)
    db.commit()
    return read_series(db, user_id, series_id)


def _validate_rule(rule: RecurrenceInput, dtstart: date) -> None:
    if rule.until_date is not None and rule.until_date < dtstart:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="until_date must be on or after the first occurrence",
        )
    if rule.freq in ("monthly", "yearly") and rule.month_day is None:
        rule.month_day = dtstart.day
    if rule.freq == "weekly" and not rule.weekdays:
        rule.weekdays = [dtstart.weekday()]


def _apply_rule(series: TaskRecurrenceSeries, rule: RecurrenceInput, dtstart: date) -> None:
    _validate_rule(rule, dtstart)
    series.freq = rule.freq
    series.interval = rule.interval
    series.weekdays = list(rule.weekdays)
    series.month_day = rule.month_day if rule.freq in ("monthly", "yearly") else None
    series.until_date = rule.until_date
    series.occurrence_limit = rule.occurrence_limit
    series.dtstart = dtstart


def _next_position(db: Session, column_id: uuid.UUID) -> int:
    max_pos = db.scalar(
        select(func.coalesce(func.max(Task.position), -1)).where(Task.column_id == column_id)
    )
    return int(max_pos if max_pos is not None else -1) + 1


def _clone_content(content: dict | None) -> dict | None:
    validate_content_urls(content)
    return uncheck_checklist(content)


def _materialize_occurrence(
    db: Session,
    series: TaskRecurrenceSeries,
    *,
    column: BoardColumn,
    occurrence: date,
    completed_at: datetime | None = None,
) -> Task | None:
    if occurrence < series.dtstart:
        return None
    if series.until_date is not None and occurrence > series.until_date:
        return None
    exception = db.scalar(
        select(TaskRecurrenceException.id).where(
            TaskRecurrenceException.series_id == series.id,
            TaskRecurrenceException.original_occurrence_date == occurrence,
        )
    )
    if exception is not None:
        return None
    existing = db.scalar(
        select(Task.id).where(
            Task.recurrence_series_id == series.id,
            Task.original_occurrence_date == occurrence,
        )
    )
    if existing is not None:
        return None

    due = occurrence + timedelta(days=series.duration_days)
    content = _clone_content(series.content)
    nested = db.begin_nested()
    try:
        task = Task(
            column_id=column.id,
            category_id=series.category_id,
            title=series.title,
            description=None,
            start_date=occurrence,
            due_date=due,
            priority=series.priority,
            position=_next_position(db, column.id),
            version=1,
            completed_at=completed_at,
            recurrence_series_id=series.id,
            occurrence_date=occurrence,
            original_occurrence_date=occurrence,
            occurrence_index=occurrence_index_for(series, occurrence),
            is_detached=False,
            content=content,
            content_text=extract_text_from_content(content) if content else None,
            content_schema_version=1,
        )
        db.add(task)
        db.flush()
        for item in series.link_templates:
            task.links.append(TaskLink(label=item.label, url=item.url, position=item.position))
        for item in series.subtask_templates:
            task.subtasks.append(
                TaskSubtask(title=item.title, is_completed=False, position=item.position)
            )
        db.flush()
        nested.commit()
        return task
    except IntegrityError:
        nested.rollback()
        return None


def _usable_column(db: Session, series: TaskRecurrenceSeries) -> BoardColumn | None:
    board = db.scalar(select(Board).where(Board.id == series.board_id))
    if board is None or board.archived_at is not None:
        return None
    if series.default_column_id is not None:
        column = db.scalar(
            select(BoardColumn).where(BoardColumn.id == series.default_column_id).with_for_update()
        )
        if column is not None and column.archived_at is None:
            return column
    return db.scalar(
        select(BoardColumn)
        .where(
            BoardColumn.board_id == series.board_id,
            BoardColumn.archived_at.is_(None),
            BoardColumn.is_done.is_(False),
        )
        .order_by(BoardColumn.position)
        .with_for_update()
        .limit(1)
    )


def generate_series_window(
    db: Session,
    series: TaskRecurrenceSeries,
    *,
    start: date,
    end: date,
    ensure_next: bool = True,
    strict: bool = False,
) -> RecurrenceGenerateResult:
    if series.status != "active":
        return RecurrenceGenerateResult(created=0, skipped=0)
    if end < start:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Generate end date must be on or after start date",
        )
    if (end - start).days > MAX_GENERATE_DAYS:
        end = start + timedelta(days=MAX_GENERATE_DAYS)

    column = _usable_column(db, series)
    if column is None:
        if strict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Recurrence cannot generate because the board or starting status is unavailable",
            )
        return RecurrenceGenerateResult(created=0, skipped=0)

    wanted = list_occurrence_dates(series, until=end, after=max(start, series.dtstart))
    if ensure_next:
        search_end = calendar_today(series.timezone) + timedelta(days=365 * NEXT_SEARCH_YEARS)
        upcoming = list_occurrence_dates(
            series,
            until=search_end,
            after=max(calendar_today(series.timezone), series.dtstart),
            limit=1,
        )
        for item in upcoming:
            if item not in wanted:
                wanted.append(item)

    created = 0
    skipped = 0
    for occurrence in wanted:
        task = _materialize_occurrence(db, series, column=column, occurrence=occurrence)
        if task is None:
            skipped += 1
        else:
            created += 1

    series.generated_through = max(end + timedelta(days=1), series.generated_through or end)
    series.updated_at = datetime.now(UTC)
    series.version += 1
    return RecurrenceGenerateResult(created=created, skipped=skipped)


def generate_for_request(
    db: Session,
    user_id: uuid.UUID,
    series_id: uuid.UUID,
    start: date | None,
    end: date | None,
) -> RecurrenceGenerateResult:
    series = db.scalar(
        select(TaskRecurrenceSeries)
        .where(TaskRecurrenceSeries.id == series_id, TaskRecurrenceSeries.user_id == user_id)
        .options(
            selectinload(TaskRecurrenceSeries.link_templates),
            selectinload(TaskRecurrenceSeries.subtask_templates),
        )
        .with_for_update()
    )
    if series is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recurrence series not found")
    today = calendar_today(series.timezone)
    window_start = start or today
    window_end = end or (today + timedelta(days=HORIZON_DAYS))
    result = generate_series_window(
        db, series, start=window_start, end=window_end, ensure_next=True, strict=True
    )
    db.commit()
    return result


def fill_user_series(
    db: Session,
    user_id: uuid.UUID,
    *,
    start: date,
    end: date,
    board_id: uuid.UUID | None = None,
) -> None:
    query = (
        select(TaskRecurrenceSeries)
        .where(TaskRecurrenceSeries.user_id == user_id, TaskRecurrenceSeries.status == "active")
        .options(
            selectinload(TaskRecurrenceSeries.link_templates),
            selectinload(TaskRecurrenceSeries.subtask_templates),
        )
        .with_for_update()
    )
    if board_id is not None:
        query = query.where(TaskRecurrenceSeries.board_id == board_id)
    series_rows = list(db.scalars(query).all())
    for series in series_rows:
        generate_series_window(db, series, start=start, end=end, ensure_next=True, strict=False)


def ensure_next_after_completion(db: Session, task: Task) -> None:
    if task.recurrence_series_id is None:
        return
    series = db.scalar(
        select(TaskRecurrenceSeries)
        .where(TaskRecurrenceSeries.id == task.recurrence_series_id)
        .options(
            selectinload(TaskRecurrenceSeries.link_templates),
            selectinload(TaskRecurrenceSeries.subtask_templates),
        )
        .with_for_update()
    )
    if series is None or series.status != "active":
        return
    today = calendar_today(series.timezone)
    generate_series_window(
        db,
        series,
        start=today,
        end=today + timedelta(days=HORIZON_DAYS),
        ensure_next=True,
        strict=False,
    )


def create_recurring_task(db: Session, user_id: uuid.UUID, payload: TaskCreate) -> TaskDetailRead:
    assert payload.recurrence is not None
    column = get_column_or_404(db, user_id, payload.column_id)
    board = db.scalar(select(Board).where(Board.id == column.board_id, Board.user_id == user_id))
    if board is None or board.archived_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Board not found")
    ensure_category_on_board(db, payload.category_id, column.board_id)
    db.scalar(select(BoardColumn).where(BoardColumn.id == column.id).with_for_update())

    start = payload.start_date or payload.due_date
    duration = (payload.due_date - start).days
    rule = payload.recurrence
    _validate_rule(rule, start)
    template_content = _clone_content(payload.content)

    user = db.get(User, user_id)
    timezone_name = user.timezone if user is not None else "UTC"

    default_column_id = column.id
    if column.is_done:
        fallback = db.scalar(
            select(BoardColumn)
            .where(
                BoardColumn.board_id == board.id,
                BoardColumn.archived_at.is_(None),
                BoardColumn.is_done.is_(False),
            )
            .order_by(BoardColumn.position)
            .limit(1)
        )
        if fallback is not None:
            default_column_id = fallback.id

    now = datetime.now(UTC)
    series = TaskRecurrenceSeries(
        user_id=user_id,
        board_id=board.id,
        default_column_id=default_column_id,
        category_id=payload.category_id,
        title=payload.title.strip(),
        priority=payload.priority.value,
        content=template_content,
        content_text=extract_text_from_content(template_content) if template_content else None,
        content_schema_version=1,
        duration_days=duration,
        timezone=timezone_name,
        status="active",
        generated_through=None,
        version=1,
    )
    _apply_rule(series, rule, start)
    db.add(series)
    db.flush()
    for item in payload.links:
        series.link_templates.append(
            TaskRecurrenceLinkTemplate(label=item.label.strip(), url=item.url, position=item.position)
        )

    first = Task(
        column_id=column.id,
        category_id=payload.category_id,
        title=payload.title.strip(),
        description=payload.description,
        start_date=start,
        due_date=payload.due_date,
        priority=payload.priority.value,
        position=_next_position(db, column.id),
        version=1,
        completed_at=now if column.is_done else None,
        recurrence_series_id=series.id,
        occurrence_date=start,
        original_occurrence_date=start,
        occurrence_index=1,
        is_detached=False,
    )
    first.content = template_content
    first.content_text = extract_text_from_content(template_content) if template_content else None
    first.content_schema_version = 1
    db.add(first)
    db.flush()
    for item in payload.links:
        first.links.append(
            TaskLink(
                id=item.id or uuid.uuid4(),
                label=item.label.strip(),
                url=item.url,
                position=item.position,
            )
        )
    today = calendar_today(series.timezone)
    generate_series_window(
        db,
        series,
        start=today,
        end=today + timedelta(days=HORIZON_DAYS),
        ensure_next=True,
        strict=True,
    )
    db.commit()
    loaded = get_task_for_user(db, user_id, first.id, with_details=True)
    loaded.recurrence_series = series
    return to_detail(loaded)


def _is_completed(task: Task) -> bool:
    if task.completed_at is not None:
        return True
    column = task.column
    return bool(column is not None and column.is_done)


def _open_attached(db: Session, series_id: uuid.UUID, *, on_or_after: date | None = None) -> list[Task]:
    query = (
        select(Task)
        .join(BoardColumn, BoardColumn.id == Task.column_id)
        .where(
            Task.recurrence_series_id == series_id,
            Task.is_detached.is_(False),
            Task.completed_at.is_(None),
            BoardColumn.is_done.is_(False),
        )
        .options(selectinload(Task.links), selectinload(Task.subtasks))
        .with_for_update()
    )
    if on_or_after is not None:
        query = query.where(Task.original_occurrence_date >= on_or_after)
    return list(db.scalars(query).all())


def _compact_column(db: Session, column_id: uuid.UUID, old_position: int) -> None:
    from sqlalchemy import update

    db.execute(
        update(Task)
        .where(Task.column_id == column_id, Task.position > old_position)
        .values(position=Task.position - 1)
    )


def _delete_task_row(db: Session, task: Task, *, delete_files: bool) -> None:
    column_id = task.column_id
    old_position = task.position
    storage_keys = [attachment.storage_key for attachment in (task.attachments or [])]
    db.delete(task)
    db.flush()
    _compact_column(db, column_id, old_position)
    if delete_files:
        storage = get_storage()
        for key in storage_keys:
            storage.delete(key)


def _add_exception(db: Session, series_id: uuid.UUID, original: date) -> None:
    existing = db.scalar(
        select(TaskRecurrenceException.id).where(
            TaskRecurrenceException.series_id == series_id,
            TaskRecurrenceException.original_occurrence_date == original,
        )
    )
    if existing is None:
        db.add(TaskRecurrenceException(series_id=series_id, original_occurrence_date=original))


def delete_with_scope(
    db: Session,
    user_id: uuid.UUID,
    task_id: uuid.UUID,
    *,
    delete_scope: str,
    confirm_completed: bool,
) -> None:
    task = get_task_for_user(db, user_id, task_id, with_details=True, for_update=True)
    if task.recurrence_series_id is None:
        from app.services.task_service import delete_task

        delete_task(db, user_id, task_id)
        return

    series = get_series_for_user(db, user_id, task.recurrence_series_id)
    completed = _is_completed(task)

    if delete_scope == "this":
        if completed and not confirm_completed:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Deleting a completed repeating task requires confirm_completed=true",
            )
        original = task.original_occurrence_date or task.start_date
        if not completed:
            _add_exception(db, series.id, original)
        _delete_task_row(db, task, delete_files=True)
        db.commit()
        return

    if delete_scope == "this_and_future":
        original = task.original_occurrence_date or task.start_date
        cutoff = original - timedelta(days=1)
        series.until_date = cutoff if cutoff >= series.dtstart else series.dtstart
        if original <= series.dtstart:
            series.status = "stopped"
        else:
            series.until_date = cutoff
        series.occurrence_limit = None
        future_open = _open_attached(db, series.id, on_or_after=original)
        for item in future_open:
            _add_exception(db, series.id, item.original_occurrence_date or item.start_date)
            _delete_task_row(db, item, delete_files=True)
        series.updated_at = datetime.now(UTC)
        db.commit()
        return

    if delete_scope == "series":
        series.status = "stopped"
        open_tasks = _open_attached(db, series.id)
        for item in open_tasks:
            _delete_task_row(db, item, delete_files=True)
        series.updated_at = datetime.now(UTC)
        db.commit()
        return

    raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid delete_scope")


def _sync_template_from_payload(series: TaskRecurrenceSeries, payload: TaskUpdate, task: Task) -> None:
    data = payload.model_dump(exclude_unset=True)
    if "title" in data and data["title"] is not None:
        series.title = data["title"].strip()
    if "priority" in data and data["priority"] is not None:
        priority = data["priority"]
        series.priority = priority.value if hasattr(priority, "value") else priority
    if "category_id" in data and data["category_id"] is not None:
        series.category_id = data["category_id"]
    if "content" in data:
        series.content = uncheck_checklist(data["content"])
        series.content_text = extract_text_from_content(series.content) if series.content else None
    next_start = payload.start_date if payload.start_date is not None else task.start_date
    next_due = payload.due_date if payload.due_date is not None else task.due_date
    series.duration_days = (next_due - next_start).days
    if payload.links is not None:
        series.link_templates.clear()
        for item in payload.links:
            series.link_templates.append(
                TaskRecurrenceLinkTemplate(label=item.label.strip(), url=item.url, position=item.position)
            )


def _apply_fields_to_task(task: Task, payload: TaskUpdate) -> None:
    data = payload.model_dump(exclude_unset=True)
    data.pop("recurrence", None)
    data.pop("edit_scope", None)
    links_payload = data.pop("links", None)
    new_due = data.pop("due_date", None)
    new_start = data.pop("start_date", None)
    content_provided = "content" in data
    content = data.pop("content", None) if content_provided else None
    data.pop("category_id", None)
    if "title" in data and data["title"] is not None:
        data["title"] = data["title"].strip()
    if "priority" in data and data["priority"] is not None:
        priority = data["priority"]
        data["priority"] = priority.value if hasattr(priority, "value") else priority
    next_start = new_start if new_start is not None else task.start_date
    next_due = new_due if new_due is not None else task.due_date
    if next_start > next_due:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="start_date must be on or before due_date",
        )
    if new_start is not None:
        task.start_date = new_start
        task.occurrence_date = new_start
    if new_due is not None:
        task.due_date = new_due
    for key, value in data.items():
        setattr(task, key, value)
    if content_provided:
        validate_content_urls(content)
        task.content = content
        task.content_text = extract_text_from_content(content) if content else None
    if links_payload is not None:
        task.links.clear()
        for item in links_payload:
            link = TaskLinkInput.model_validate(item)
            task.links.append(TaskLink(label=link.label.strip(), url=link.url, position=link.position))
    task.updated_at = datetime.now(UTC)


def update_with_scope(
    db: Session,
    user_id: uuid.UUID,
    task_id: uuid.UUID,
    payload: TaskUpdate,
) -> TaskDetailRead:
    from app.services.task_service import update_task

    task = get_task_for_user(db, user_id, task_id, with_details=True, for_update=True)
    if task.recurrence_series_id is None:
        return update_task(db, user_id, task_id, payload)

    scope = payload.edit_scope or "this"
    series = get_series_for_user(db, user_id, task.recurrence_series_id)
    if payload.category_id is not None:
        column = get_column_or_404(db, user_id, task.column_id)
        ensure_category_on_board(db, payload.category_id, column.board_id)

    if scope == "this":
        if payload.recurrence is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Changing the repeat rule requires This and following tasks or All tasks in the series",
            )
        _apply_fields_to_task(task, payload)
        if payload.category_id is not None:
            task.category_id = payload.category_id
        field_set = payload.model_fields_set & {
            "title",
            "content",
            "start_date",
            "due_date",
            "priority",
            "category_id",
            "links",
        }
        if field_set:
            task.is_detached = True
        db.commit()
        return to_detail(get_task_for_user(db, user_id, task_id, with_details=True))

    original = task.original_occurrence_date or task.start_date
    if scope == "this_and_future" and payload.recurrence is not None:
        new_rule = payload.recurrence
        old_until = original - timedelta(days=1)
        if old_until >= series.dtstart:
            series.until_date = old_until
            series.occurrence_limit = None
        else:
            series.status = "stopped"
        series.updated_at = datetime.now(UTC)
        future_open = _open_attached(db, series.id, on_or_after=original)
        new_series = TaskRecurrenceSeries(
            user_id=series.user_id,
            board_id=series.board_id,
            default_column_id=series.default_column_id,
            category_id=payload.category_id or series.category_id,
            title=(payload.title or series.title).strip() if payload.title else series.title,
            priority=series.priority,
            content=uncheck_checklist(payload.content) if payload.content is not None else series.content,
            content_text=series.content_text,
            content_schema_version=series.content_schema_version,
            duration_days=series.duration_days,
            timezone=series.timezone,
            status="active",
            version=1,
        )
        _sync_template_from_payload(new_series, payload, task)
        _apply_rule(new_series, new_rule, original)
        db.add(new_series)
        db.flush()
        for item in series.link_templates:
            new_series.link_templates.append(
                TaskRecurrenceLinkTemplate(label=item.label, url=item.url, position=item.position)
            )
        for item in series.subtask_templates:
            new_series.subtask_templates.append(
                TaskRecurrenceSubtaskTemplate(title=item.title, position=item.position)
            )
        task.recurrence_series_id = new_series.id
        task.is_detached = False
        _apply_fields_to_task(task, payload)
        task.original_occurrence_date = original
        task.occurrence_index = 1
        for item in future_open:
            if item.id == task.id:
                continue
            item.recurrence_series_id = new_series.id
        today = calendar_today(new_series.timezone)
        generate_series_window(
            db,
            new_series,
            start=today,
            end=today + timedelta(days=HORIZON_DAYS),
            ensure_next=True,
            strict=False,
        )
        db.commit()
        return to_detail(get_task_for_user(db, user_id, task_id, with_details=True))

    targets = _open_attached(
        db,
        series.id,
        on_or_after=original if scope == "this_and_future" else None,
    )
    _sync_template_from_payload(series, payload, task)
    if payload.recurrence is not None and scope == "series":
        _apply_rule(series, payload.recurrence, series.dtstart)
    if payload.category_id is not None:
        task.category_id = payload.category_id
    _apply_fields_to_task(task, payload)
    for item in targets:
        if item.id == task.id:
            continue
        if payload.title is not None:
            item.title = payload.title.strip()
        if payload.priority is not None:
            item.priority = payload.priority.value
        if payload.category_id is not None:
            item.category_id = payload.category_id
        if payload.content is not None:
            cloned = uncheck_checklist(payload.content)
            item.content = cloned
            item.content_text = extract_text_from_content(cloned) if cloned else None
        item.due_date = item.start_date + timedelta(days=series.duration_days)
        item.updated_at = datetime.now(UTC)
    series.updated_at = datetime.now(UTC)
    if payload.recurrence is not None and scope == "series":
        today = calendar_today(series.timezone)
        generate_series_window(
            db, series, start=today, end=today + timedelta(days=HORIZON_DAYS), ensure_next=True, strict=False
        )
    db.commit()
    return to_detail(get_task_for_user(db, user_id, task_id, with_details=True))
