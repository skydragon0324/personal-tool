from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models import Board, BoardColumn, Category, Task, TaskLink, TaskSubtask, User
from app.models.task_recurrence import (
    TaskRecurrenceException,
    TaskRecurrenceLinkTemplate,
    TaskRecurrenceSeries,
    TaskRecurrenceSubtaskTemplate,
)
from app.schemas.recurrence import (
    RecurrenceGenerateResult,
    RecurrenceInput,
    RecurrenceSeriesLinkRead,
    RecurrenceSeriesListItem,
    RecurrenceSeriesListResponse,
    RecurrenceSeriesRead,
    RecurrenceSeriesUpdate,
)
from app.schemas.task import TaskCreate, TaskDetailRead, TaskLinkInput, TaskUpdate
from app.services.board_service import get_column_or_404
from app.services.category_service import ensure_category_on_board
from app.services.content_utils import extract_text_from_content, uncheck_checklist, validate_content_urls
from app.services.ownership import get_column_for_user, get_task_for_user
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


def get_series_for_user(
    db: Session,
    user_id: uuid.UUID,
    series_id: uuid.UUID,
    *,
    for_update: bool = False,
) -> TaskRecurrenceSeries:
    query = (
        select(TaskRecurrenceSeries)
        .where(TaskRecurrenceSeries.id == series_id, TaskRecurrenceSeries.user_id == user_id)
        .options(
            selectinload(TaskRecurrenceSeries.link_templates),
            selectinload(TaskRecurrenceSeries.subtask_templates),
            selectinload(TaskRecurrenceSeries.exceptions),
        )
    )
    if for_update:
        query = query.with_for_update()
    series = db.scalar(query)
    if series is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recurrence series not found")
    return series


def next_occurrence_date(
    series: TaskRecurrenceSeries,
    *,
    today: date | None = None,
    exception_dates: set[date] | None = None,
) -> date | None:
    if series.status != "active":
        return None
    return _next_rule_occurrence(series, today=today, exception_dates=exception_dates)


def _next_rule_occurrence(
    series: TaskRecurrenceSeries,
    *,
    today: date | None = None,
    exception_dates: set[date] | None = None,
) -> date | None:
    today = today or calendar_today(series.timezone)
    exceptions = exception_dates if exception_dates is not None else set()
    search_end = today + timedelta(days=365 * NEXT_SEARCH_YEARS)
    after = max(today, series.dtstart)
    for item in list_occurrence_dates(series, until=search_end, after=after):
        if item not in exceptions:
            return item
    return None


def _task_counts_by_series(
    db: Session, series_ids: list[uuid.UUID]
) -> dict[uuid.UUID, tuple[int, int, int]]:
    if not series_ids:
        return {}
    open_expr = case((and_(Task.completed_at.is_(None), BoardColumn.is_done.is_(False)), 1), else_=0)
    completed_expr = case((or_(Task.completed_at.is_not(None), BoardColumn.is_done.is_(True)), 1), else_=0)
    detached_expr = case((Task.is_detached.is_(True), 1), else_=0)
    rows = db.execute(
        select(
            Task.recurrence_series_id,
            func.coalesce(func.sum(open_expr), 0),
            func.coalesce(func.sum(completed_expr), 0),
            func.coalesce(func.sum(detached_expr), 0),
        )
        .join(BoardColumn, BoardColumn.id == Task.column_id)
        .where(Task.recurrence_series_id.in_(series_ids))
        .group_by(Task.recurrence_series_id)
    ).all()
    return {
        series_id: (int(open_count), int(completed_count), int(detached_count))
        for series_id, open_count, completed_count, detached_count in rows
        if series_id is not None
    }


def _exception_dates_by_series(
    db: Session, series_ids: list[uuid.UUID]
) -> dict[uuid.UUID, set[date]]:
    mapped: dict[uuid.UUID, set[date]] = {series_id: set() for series_id in series_ids}
    if not series_ids:
        return mapped
    rows = db.execute(
        select(TaskRecurrenceException.series_id, TaskRecurrenceException.original_occurrence_date).where(
            TaskRecurrenceException.series_id.in_(series_ids)
        )
    ).all()
    for series_id, original in rows:
        mapped.setdefault(series_id, set()).add(original)
    return mapped


def _to_series_read(
    series: TaskRecurrenceSeries,
    *,
    open_count: int,
    completed_count: int,
    detached_count: int,
    next_date: date | None,
) -> RecurrenceSeriesRead:
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
        next_occurrence_date=next_date,
        open_count=open_count,
        completed_count=completed_count,
        detached_count=detached_count,
        version=series.version,
        content=series.content,
        content_schema_version=series.content_schema_version,
        links=[
            RecurrenceSeriesLinkRead(
                id=item.id,
                label=item.label,
                url=item.url,
                position=item.position,
            )
            for item in sorted(series.link_templates or [], key=lambda link: (link.position, str(link.id)))
        ],
    )


def read_series(db: Session, user_id: uuid.UUID, series_id: uuid.UUID) -> RecurrenceSeriesRead:
    series = get_series_for_user(db, user_id, series_id)
    counts = _task_counts_by_series(db, [series.id]).get(series.id, (0, 0, 0))
    exceptions = {item.original_occurrence_date for item in (series.exceptions or [])}
    return _to_series_read(
        series,
        open_count=counts[0],
        completed_count=counts[1],
        detached_count=counts[2],
        next_date=next_occurrence_date(series, exception_dates=exceptions),
    )


def list_series(
    db: Session,
    user_id: uuid.UUID,
    *,
    board_id: uuid.UUID | None = None,
    status: str | None = None,
    offset: int = 0,
    limit: int = 50,
) -> RecurrenceSeriesListResponse:
    query = (
        select(TaskRecurrenceSeries, Board, BoardColumn, Category)
        .join(Board, Board.id == TaskRecurrenceSeries.board_id)
        .outerjoin(BoardColumn, BoardColumn.id == TaskRecurrenceSeries.default_column_id)
        .join(Category, Category.id == TaskRecurrenceSeries.category_id)
        .where(TaskRecurrenceSeries.user_id == user_id)
    )
    if board_id is not None:
        query = query.where(TaskRecurrenceSeries.board_id == board_id)
    if status is not None:
        query = query.where(TaskRecurrenceSeries.status == status)
    rows = list(db.execute(query).all())
    series_ids = [series.id for series, _board, _column, _category in rows]
    counts = _task_counts_by_series(db, series_ids)
    exceptions = _exception_dates_by_series(db, series_ids)

    items: list[RecurrenceSeriesListItem] = []
    for series, board, column, category in rows:
        open_count, completed_count, detached_count = counts.get(series.id, (0, 0, 0))
        next_date = next_occurrence_date(series, exception_dates=exceptions.get(series.id, set()))
        items.append(
            RecurrenceSeriesListItem(
                id=series.id,
                board_id=series.board_id,
                board_name=board.name,
                board_archived=board.archived_at is not None,
                default_column_id=series.default_column_id,
                default_column_name=column.name if column is not None else None,
                category_id=series.category_id,
                category_name=category.name,
                title=series.title,
                priority=series.priority,
                timezone=series.timezone,
                freq=series.freq,  # type: ignore[arg-type]
                interval=series.interval,
                weekdays=list(series.weekdays or []),
                month_day=series.month_day,
                start_date=series.dtstart,
                end_date=series.until_date,
                occurrence_limit=series.occurrence_limit,
                status=series.status,  # type: ignore[arg-type]
                generated_through=series.generated_through,
                next_occurrence_date=next_date,
                open_occurrence_count=open_count,
                completed_occurrence_count=completed_count,
                detached_occurrence_count=detached_count,
                created_at=series.created_at,
                updated_at=series.updated_at,
            )
        )

    items.sort(
        key=lambda item: (
            0 if item.status == "active" and item.next_occurrence_date is not None else 1,
            item.next_occurrence_date or date.max,
            -item.updated_at.timestamp(),
            str(item.id),
        )
    )
    total = len(items)
    page = items[offset : offset + limit]
    return RecurrenceSeriesListResponse(items=page, total=total, offset=offset, limit=limit)


def _assert_can_resume(db: Session, series: TaskRecurrenceSeries) -> None:
    board = db.get(Board, series.board_id)
    if board is None or board.archived_at is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Recurrence cannot resume because the board is archived or unavailable",
        )
    if series.default_column_id is not None:
        column = db.get(BoardColumn, series.default_column_id)
        if (
            column is None
            or column.board_id != series.board_id
            or column.archived_at is not None
            or column.is_done
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Recurrence cannot resume because the starting status is unavailable",
            )
    else:
        fallback = db.scalar(
            select(BoardColumn).where(
                BoardColumn.board_id == series.board_id,
                BoardColumn.archived_at.is_(None),
                BoardColumn.is_done.is_(False),
            )
        )
        if fallback is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Recurrence cannot resume because the starting status is unavailable",
            )
    category = db.get(Category, series.category_id)
    if category is None or category.board_id != series.board_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Recurrence cannot resume because the category is not on this board",
        )
    exceptions = {item.original_occurrence_date for item in (series.exceptions or [])}
    if _next_rule_occurrence(series, exception_dates=exceptions) is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Recurrence cannot resume because there is no remaining occurrence",
        )


def stop_series(db: Session, user_id: uuid.UUID, series_id: uuid.UUID) -> RecurrenceSeriesRead:
    series = get_series_for_user(db, user_id, series_id, for_update=True)
    if series.status == "archived":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Archived recurrence series cannot be stopped",
        )
    if series.status == "stopped":
        return read_series(db, user_id, series_id)
    series.status = "stopped"
    series.updated_at = datetime.now(UTC)
    series.version += 1
    db.commit()
    return read_series(db, user_id, series_id)


def resume_series(db: Session, user_id: uuid.UUID, series_id: uuid.UUID) -> RecurrenceSeriesRead:
    series = get_series_for_user(db, user_id, series_id, for_update=True)
    if series.status == "archived":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Archived recurrence series cannot be resumed",
        )
    if series.status == "active":
        return read_series(db, user_id, series_id)
    _assert_can_resume(db, series)
    series.status = "active"
    series.updated_at = datetime.now(UTC)
    series.version += 1
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
    bump_version: bool = True,
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
    if bump_version:
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
        .options(
            selectinload(Task.links),
            selectinload(Task.subtasks),
            selectinload(Task.attachments),
        )
        .with_for_update()
    )
    if on_or_after is not None:
        query = query.where(Task.original_occurrence_date >= on_or_after)
    return list(db.scalars(query).all())


def _renumber_columns(db: Session, column_ids: set[uuid.UUID]) -> None:
    for column_id in column_ids:
        rows = list(
            db.scalars(
                select(Task).where(Task.column_id == column_id).order_by(Task.position, Task.id)
            ).all()
        )
        for index, row in enumerate(rows):
            if row.position != index:
                row.position = index
        db.flush()


def _delete_storage_keys(storage_keys: list[str]) -> None:
    if not storage_keys:
        return
    storage = get_storage()
    for key in storage_keys:
        storage.delete(key)


def _delete_task_row(db: Session, task: Task, *, delete_files: bool) -> tuple[list[str], uuid.UUID]:
    column_id = task.column_id
    storage_keys = [attachment.storage_key for attachment in (task.attachments or [])]
    db.delete(task)
    db.flush()
    if delete_files:
        _delete_storage_keys(storage_keys)
        return [], column_id
    return storage_keys, column_id


def _add_exception(db: Session, series_id: uuid.UUID, original: date) -> None:
    existing = db.scalar(
        select(TaskRecurrenceException.id).where(
            TaskRecurrenceException.series_id == series_id,
            TaskRecurrenceException.original_occurrence_date == original,
        )
    )
    if existing is None:
        db.add(TaskRecurrenceException(series_id=series_id, original_occurrence_date=original))


def _collect_delete(db: Session, task: Task, keys: list[str], columns: set[uuid.UUID]) -> None:
    storage_keys, column_id = _delete_task_row(db, task, delete_files=False)
    keys.extend(storage_keys)
    columns.add(column_id)


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

    if delete_scope not in {"this", "this_and_future", "series"}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid delete_scope")

    series = get_series_for_user(db, user_id, task.recurrence_series_id, for_update=True)
    completed = _is_completed(task)
    original = task.original_occurrence_date or task.start_date
    keys: list[str] = []
    columns: set[uuid.UUID] = set()

    if delete_scope == "this":
        if completed and not confirm_completed:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Deleting a completed repeating task requires confirm_completed=true",
            )
        _add_exception(db, series.id, original)
        _collect_delete(db, task, keys, columns)
        _renumber_columns(db, columns)
        db.commit()
        _delete_storage_keys(keys)
        return

    if delete_scope == "this_and_future":
        if original <= series.dtstart:
            series.status = "stopped"
        else:
            series.until_date = original - timedelta(days=1)
        series.occurrence_limit = None
        future_open = _open_attached(db, series.id, on_or_after=original)
        deleted_ids: set[uuid.UUID] = set()
        for item in future_open:
            _add_exception(db, series.id, item.original_occurrence_date or item.start_date)
            _collect_delete(db, item, keys, columns)
            deleted_ids.add(item.id)
        if task.id not in deleted_ids and task.is_detached:
            _add_exception(db, series.id, original)
            _collect_delete(db, task, keys, columns)
        series.updated_at = datetime.now(UTC)
        _renumber_columns(db, columns)
        db.commit()
        _delete_storage_keys(keys)
        return

    series.status = "stopped"
    for item in _open_attached(db, series.id):
        _collect_delete(db, item, keys, columns)
    series.updated_at = datetime.now(UTC)
    _renumber_columns(db, columns)
    db.commit()
    _delete_storage_keys(keys)


def _priority_value(priority: object) -> str:
    return priority.value if hasattr(priority, "value") else str(priority)


def _normalized_weekdays(weekdays: list[int] | None, *, freq: str, dtstart: date) -> tuple[int, ...]:
    days = sorted({int(day) for day in (weekdays or []) if 0 <= int(day) <= 6})
    if freq == "weekly" and not days:
        days = [dtstart.weekday()]
    if freq != "weekly":
        return ()
    return tuple(days)


def _normalized_month_day(month_day: int | None, *, freq: str, dtstart: date) -> int | None:
    if freq not in {"monthly", "yearly"}:
        return None
    return int(month_day) if month_day is not None else dtstart.day


def _rule_signature(
    *,
    freq: str,
    interval: int,
    weekdays: list[int] | None,
    month_day: int | None,
    until_date: date | None,
    occurrence_limit: int | None,
    dtstart: date,
) -> tuple[object, ...]:
    return (
        freq,
        int(interval),
        _normalized_weekdays(weekdays, freq=freq, dtstart=dtstart),
        _normalized_month_day(month_day, freq=freq, dtstart=dtstart),
        dtstart.month if freq == "yearly" else None,
        until_date,
        occurrence_limit,
    )


def _recurrence_rule_changed(
    series: TaskRecurrenceSeries,
    rule: RecurrenceInput | None,
    *,
    incoming_dtstart: date | None = None,
) -> bool:
    if rule is None:
        return False
    incoming_anchor = incoming_dtstart or series.dtstart
    current = _rule_signature(
        freq=series.freq,
        interval=series.interval,
        weekdays=list(series.weekdays or []),
        month_day=series.month_day,
        until_date=series.until_date,
        occurrence_limit=series.occurrence_limit,
        dtstart=series.dtstart,
    )
    incoming = _rule_signature(
        freq=rule.freq,
        interval=rule.interval,
        weekdays=list(rule.weekdays or []),
        month_day=rule.month_day,
        until_date=rule.until_date,
        occurrence_limit=rule.occurrence_limit,
        dtstart=incoming_anchor,
    )
    return current != incoming


def _prepared_rule(payload: TaskUpdate) -> RecurrenceInput:
    assert payload.recurrence is not None
    rule = payload.recurrence.model_copy()
    if rule.freq in ("monthly", "yearly") and rule.month_day is None and payload.start_date is not None:
        rule.month_day = payload.start_date.day
    return rule


def _link_tuples(links: list | None) -> list[tuple[str, str, int]]:
    result: list[tuple[str, str, int]] = []
    for item in links or []:
        link = item if isinstance(item, TaskLinkInput) else TaskLinkInput.model_validate(item)
        result.append((link.label.strip(), link.url, link.position))
    return result


def _occurrence_fields_changed(task: Task, payload: TaskUpdate) -> bool:
    data = payload.model_dump(exclude_unset=True)
    if "title" in data and data["title"] is not None and data["title"].strip() != task.title:
        return True
    if "start_date" in data and data["start_date"] is not None and data["start_date"] != task.start_date:
        return True
    if "due_date" in data and data["due_date"] is not None and data["due_date"] != task.due_date:
        return True
    if "priority" in data and data["priority"] is not None and _priority_value(data["priority"]) != task.priority:
        return True
    if "category_id" in data and data["category_id"] is not None and data["category_id"] != task.category_id:
        return True
    if "content" in data and data["content"] != task.content:
        return True
    if "links" in data and data["links"] is not None:
        current = [(link.label, link.url, link.position) for link in task.links]
        incoming = _link_tuples(data["links"])
        if current != incoming:
            return True
    return False


def _date_matches_rule(series: TaskRecurrenceSeries, occurrence: date | None) -> bool:
    if occurrence is None:
        return False
    dates = list_occurrence_dates(series, until=occurrence)
    return bool(dates) and dates[-1] == occurrence


def _first_occurrence_on_or_after(series: TaskRecurrenceSeries, start: date) -> date:
    until = start + timedelta(days=365 * NEXT_SEARCH_YEARS)
    dates = list_occurrence_dates(series, until=until, after=start)
    if not dates:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Recurrence rule has no available occurrence date for this task",
        )
    return dates[0]


def _align_attached_occurrence(task: Task, series: TaskRecurrenceSeries) -> None:
    if task.is_detached:
        return
    original = task.original_occurrence_date or task.start_date
    task.original_occurrence_date = original
    task.occurrence_date = original
    task.start_date = original
    task.due_date = original + timedelta(days=series.duration_days)
    task.occurrence_index = occurrence_index_for(series, original)


def _purge_open_attached(
    db: Session,
    series_id: uuid.UUID,
    *,
    on_or_after: date | None = None,
    keep_ids: set[uuid.UUID] | None = None,
    only_invalid_for: TaskRecurrenceSeries | None = None,
    delete_files: bool = True,
) -> list[str]:
    keep = keep_ids or set()
    columns: set[uuid.UUID] = set()
    keys: list[str] = []
    for item in _open_attached(db, series_id, on_or_after=on_or_after):
        if item.id in keep:
            continue
        if only_invalid_for is not None and _date_matches_rule(only_invalid_for, item.original_occurrence_date):
            continue
        storage_keys, column_id = _delete_task_row(db, item, delete_files=delete_files)
        keys.extend(storage_keys)
        columns.add(column_id)
    _renumber_columns(db, columns)
    return keys


def _replace_link_templates(db: Session, series: TaskRecurrenceSeries, links: list[TaskLinkInput]) -> None:
    series.link_templates.clear()
    db.flush()
    for item in links:
        series.link_templates.append(
            TaskRecurrenceLinkTemplate(label=item.label.strip(), url=item.url, position=item.position)
        )


def _replace_task_links(db: Session, task: Task, links: list) -> None:
    task.links.clear()
    db.flush()
    for item in links:
        link = TaskLinkInput.model_validate(item)
        task.links.append(TaskLink(label=link.label.strip(), url=link.url, position=link.position))


def _copy_child_templates(source: TaskRecurrenceSeries, target: TaskRecurrenceSeries, *, copy_links: bool) -> None:
    if copy_links:
        for item in source.link_templates:
            target.link_templates.append(
                TaskRecurrenceLinkTemplate(label=item.label, url=item.url, position=item.position)
            )
    for item in source.subtask_templates:
        target.subtask_templates.append(
            TaskRecurrenceSubtaskTemplate(title=item.title, position=item.position)
        )


def _sync_template_from_payload(
    db: Session, series: TaskRecurrenceSeries, payload: TaskUpdate, task: Task
) -> None:
    data = payload.model_dump(exclude_unset=True)
    if "title" in data and data["title"] is not None:
        series.title = data["title"].strip()
    if "priority" in data and data["priority"] is not None:
        series.priority = _priority_value(data["priority"])
    if "category_id" in data and data["category_id"] is not None:
        series.category_id = data["category_id"]
    if "content" in data:
        series.content = uncheck_checklist(data["content"])
        series.content_text = extract_text_from_content(series.content) if series.content else None
    next_start = payload.start_date if payload.start_date is not None else task.start_date
    next_due = payload.due_date if payload.due_date is not None else task.due_date
    series.duration_days = (next_due - next_start).days
    if payload.links is not None:
        _replace_link_templates(db, series, payload.links)


def _apply_fields_to_task(db: Session, task: Task, payload: TaskUpdate, *, shift_dates: bool) -> None:
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
        data["priority"] = _priority_value(data["priority"])
    if shift_dates:
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
    if payload.category_id is not None:
        task.category_id = payload.category_id
    if links_payload is not None:
        _replace_task_links(db, task, links_payload)
    task.updated_at = datetime.now(UTC)


def _apply_template_to_open_task(db: Session, task: Task, payload: TaskUpdate, *, duration_days: int) -> None:
    if payload.title is not None:
        task.title = payload.title.strip()
    if payload.priority is not None:
        task.priority = _priority_value(payload.priority)
    if payload.category_id is not None:
        task.category_id = payload.category_id
    if payload.content is not None:
        cloned = uncheck_checklist(payload.content)
        task.content = cloned
        task.content_text = extract_text_from_content(cloned) if cloned else None
    if payload.links is not None:
        _replace_task_links(db, task, payload.links)
    task.due_date = task.start_date + timedelta(days=duration_days)
    task.updated_at = datetime.now(UTC)


def _occupied_originals(db: Session, series_id: uuid.UUID) -> set[date]:
    return {
        item
        for item in db.scalars(
            select(Task.original_occurrence_date).where(
                Task.recurrence_series_id == series_id,
                Task.original_occurrence_date.is_not(None),
            )
        ).all()
        if item is not None
    }


def _remap_to_valid_date(db: Session, series: TaskRecurrenceSeries, task: Task) -> None:
    original = task.original_occurrence_date or task.start_date
    occupied = _occupied_originals(db, series.id) - {original}
    until = original + timedelta(days=365 * NEXT_SEARCH_YEARS)
    for candidate in list_occurrence_dates(series, until=until, after=original):
        if candidate in occupied:
            continue
        task.original_occurrence_date = candidate
        _align_attached_occurrence(task, series)
        task.is_detached = False
        return
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Recurrence rule has no available occurrence date for this task",
    )


def _end_old_series(series: TaskRecurrenceSeries, split_point: date) -> None:
    old_until = split_point - timedelta(days=1)
    if old_until >= series.dtstart:
        series.until_date = old_until
        series.occurrence_limit = None
    else:
        series.status = "stopped"
    series.updated_at = datetime.now(UTC)


def _fill_horizon(db: Session, series: TaskRecurrenceSeries, *, bump_version: bool = True) -> None:
    today = calendar_today(series.timezone)
    generate_series_window(
        db,
        series,
        start=today,
        end=today + timedelta(days=HORIZON_DAYS),
        ensure_next=True,
        strict=False,
        bump_version=bump_version,
    )


def _current_rule(series: TaskRecurrenceSeries) -> RecurrenceInput:
    return RecurrenceInput(
        freq=series.freq,  # type: ignore[arg-type]
        interval=series.interval,
        weekdays=list(series.weekdays or []),
        month_day=series.month_day,
        until_date=series.until_date,
        occurrence_limit=series.occurrence_limit,
    )


def _series_links_changed(series: TaskRecurrenceSeries, links: list[TaskLinkInput]) -> bool:
    current = [(item.label, item.url, item.position) for item in series.link_templates]
    incoming = _link_tuples(links)
    return current != incoming


def _apply_series_template_to_open(
    db: Session,
    task: Task,
    series: TaskRecurrenceSeries,
    changed: set[str],
    *,
    align_dates: bool,
) -> None:
    if "title" in changed:
        task.title = series.title
    if "priority" in changed:
        task.priority = series.priority
    if "category_id" in changed:
        task.category_id = series.category_id
    if "content" in changed:
        cloned = uncheck_checklist(series.content)
        task.content = cloned
        task.content_text = extract_text_from_content(cloned) if cloned else None
        task.content_schema_version = series.content_schema_version
    if "links" in changed:
        _replace_task_links(
            db,
            task,
            [
                TaskLinkInput(label=item.label, url=item.url, position=item.position)
                for item in series.link_templates
            ],
        )
    if align_dates or "duration_days" in changed:
        _align_attached_occurrence(task, series)
    task.updated_at = datetime.now(UTC)


def _validate_series_default_column(
    db: Session,
    user_id: uuid.UUID,
    series: TaskRecurrenceSeries,
    column_id: uuid.UUID,
) -> BoardColumn:
    column = get_column_for_user(db, user_id, column_id)
    if column.board_id != series.board_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Starting status does not belong to this board",
        )
    if column.archived_at is not None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cannot use an archived status as the starting status",
        )
    if column.is_done:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cannot use a completed status as the starting status",
        )
    return column


def update_series(
    db: Session,
    user_id: uuid.UUID,
    series_id: uuid.UUID,
    payload: RecurrenceSeriesUpdate,
) -> RecurrenceSeriesRead:
    series = get_series_for_user(db, user_id, series_id, for_update=True)
    board = db.get(Board, series.board_id)
    if series.status == "archived":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Archived recurrence series cannot be edited",
        )
    if board is None or board.archived_at is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Recurring tasks on an archived board cannot be edited",
        )
    if series.version != payload.expected_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Recurrence series version is stale; refresh and try again",
        )

    fields = payload.model_fields_set
    if "content" in fields:
        validate_content_urls(payload.content)
    if payload.category_id is not None:
        ensure_category_on_board(db, payload.category_id, series.board_id)
    if "default_column_id" in fields and payload.default_column_id is not None:
        _validate_series_default_column(db, user_id, series, payload.default_column_id)

    incoming_links: list[TaskLinkInput] | None
    if "links" not in fields:
        incoming_links = None
    elif payload.links is None:
        incoming_links = []
    else:
        incoming_links = [TaskLinkInput.model_validate(item.model_dump()) for item in payload.links]
    incoming_dtstart = payload.dtstart if "dtstart" in fields and payload.dtstart is not None else series.dtstart
    incoming_rule = payload.recurrence if payload.recurrence is not None else _current_rule(series)
    rule_or_start_changed = False
    if "dtstart" in fields and payload.dtstart is not None and payload.dtstart != series.dtstart:
        rule_or_start_changed = True
    if payload.recurrence is not None and _recurrence_rule_changed(
        series, payload.recurrence, incoming_dtstart=incoming_dtstart
    ):
        rule_or_start_changed = True

    changed: set[str] = set()
    if payload.title is not None and payload.title != series.title:
        changed.add("title")
    if payload.priority is not None and payload.priority != series.priority:
        changed.add("priority")
    if "content" in fields and uncheck_checklist(payload.content) != series.content:
        changed.add("content")
    if payload.category_id is not None and payload.category_id != series.category_id:
        changed.add("category_id")
    if "default_column_id" in fields and payload.default_column_id != series.default_column_id:
        changed.add("default_column_id")
    if payload.duration_days is not None and payload.duration_days != series.duration_days:
        changed.add("duration_days")
    if incoming_links is not None and _series_links_changed(series, incoming_links):
        changed.add("links")
    if rule_or_start_changed:
        changed.add("rule")

    if not changed:
        return read_series(db, user_id, series_id)

    if "title" in changed and payload.title is not None:
        series.title = payload.title
    if "priority" in changed and payload.priority is not None:
        series.priority = payload.priority
    if "content" in changed:
        series.content = uncheck_checklist(payload.content)
        series.content_text = extract_text_from_content(series.content) if series.content else None
    if "category_id" in changed and payload.category_id is not None:
        series.category_id = payload.category_id
    if "default_column_id" in changed:
        series.default_column_id = payload.default_column_id
    if "duration_days" in changed and payload.duration_days is not None:
        series.duration_days = payload.duration_days
    if "links" in changed and incoming_links is not None:
        _replace_link_templates(db, series, incoming_links)

    storage_keys: list[str] = []
    if rule_or_start_changed:
        _apply_rule(series, incoming_rule, incoming_dtstart)
        storage_keys.extend(_purge_open_attached(db, series.id, only_invalid_for=series, delete_files=False))

    template_changed = bool(changed - {"default_column_id", "rule"})
    if template_changed or rule_or_start_changed:
        for item in _open_attached(db, series.id):
            _apply_series_template_to_open(
                db,
                item,
                series,
                changed,
                align_dates=rule_or_start_changed,
            )

    if rule_or_start_changed and series.status == "active":
        _fill_horizon(db, series, bump_version=False)

    series.updated_at = datetime.now(UTC)
    series.version += 1
    db.commit()
    _delete_storage_keys(storage_keys)
    return read_series(db, user_id, series_id)


def _split_series_with_new_rule(
    db: Session,
    series: TaskRecurrenceSeries,
    task: Task,
    payload: TaskUpdate,
) -> TaskRecurrenceSeries:
    split_point = task.original_occurrence_date or task.start_date
    requested = payload.start_date if payload.start_date is not None else split_point
    rule = _prepared_rule(payload)
    _end_old_series(series, split_point)
    _purge_open_attached(db, series.id, on_or_after=split_point, keep_ids={task.id})

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
    _sync_template_from_payload(db, new_series, payload, task)
    _apply_rule(new_series, rule, requested)
    db.add(new_series)
    db.flush()
    _copy_child_templates(series, new_series, copy_links=payload.links is None)

    task.recurrence_series_id = new_series.id
    task.is_detached = False
    _apply_fields_to_task(db, task, payload, shift_dates=False)
    floor = requested if requested >= split_point else split_point
    anchor = _first_occurrence_on_or_after(new_series, floor)
    new_series.dtstart = anchor
    task.original_occurrence_date = anchor
    _align_attached_occurrence(task, new_series)
    _fill_horizon(db, new_series)
    return new_series


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
    series = get_series_for_user(db, user_id, task.recurrence_series_id, for_update=True)
    explicit_stop = "recurrence" in payload.model_fields_set and payload.recurrence is None
    if payload.category_id is not None:
        column = get_column_or_404(db, user_id, task.column_id)
        ensure_category_on_board(db, payload.category_id, column.board_id)

    if explicit_stop:
        series.status = "stopped"
        scope = "series"
        rule_changed = False
    else:
        rule_changed = _recurrence_rule_changed(
            series, payload.recurrence, incoming_dtstart=payload.start_date
        )

    if scope == "this":
        if rule_changed:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Changing the repeat rule requires This and following tasks or All tasks in the series",
            )
        fields_changed = _occurrence_fields_changed(task, payload)
        _apply_fields_to_task(db, task, payload, shift_dates=True)
        if fields_changed:
            task.is_detached = True
        db.commit()
        return to_detail(get_task_for_user(db, user_id, task_id, with_details=True))

    if scope not in {"this_and_future", "series"}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid edit_scope")

    original = task.original_occurrence_date or task.start_date
    if scope == "this_and_future" and rule_changed:
        new_series = _split_series_with_new_rule(db, series, task, payload)
        _align_attached_occurrence(task, new_series)
        db.commit()
        return to_detail(get_task_for_user(db, user_id, task_id, with_details=True))

    _sync_template_from_payload(db, series, payload, task)
    if scope == "series" and rule_changed:
        assert payload.recurrence is not None
        incoming_month = (payload.start_date or series.dtstart).month
        if payload.recurrence.freq == "yearly" and incoming_month != series.dtstart.month:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    "Yearly month cannot be changed for the entire series because it is stored "
                    "as the series start date. Use This and following tasks to start a new yearly series."
                ),
            )
        rule = _prepared_rule(payload)
        _apply_rule(series, rule, series.dtstart)
        _purge_open_attached(db, series.id, keep_ids={task.id}, only_invalid_for=series)
        if not _date_matches_rule(series, task.original_occurrence_date):
            _remap_to_valid_date(db, series, task)
        _fill_horizon(db, series)

    _apply_fields_to_task(db, task, payload, shift_dates=False)
    if not task.is_detached:
        _align_attached_occurrence(task, series)

    targets = _open_attached(
        db,
        series.id,
        on_or_after=original if scope == "this_and_future" else None,
    )
    for item in targets:
        if item.id == task.id:
            continue
        _apply_template_to_open_task(db, item, payload, duration_days=series.duration_days)
        if not item.is_detached:
            _align_attached_occurrence(item, series)
    series.updated_at = datetime.now(UTC)
    db.commit()
    return to_detail(get_task_for_user(db, user_id, task_id, with_details=True))
