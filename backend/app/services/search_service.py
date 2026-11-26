from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import case, func, null, or_, select
from sqlalchemy.orm import Session
from sqlalchemy.sql.elements import ColumnElement

from app.models import Board, BoardColumn, Note, Plan, Task
from app.schemas.search import SearchGroup, SearchResponse, SearchResult, SearchType
from app.services.ownership import board_access

SEARCH_TYPES: tuple[SearchType, ...] = ("task", "board", "note", "plan")
SEARCH_DEFAULT_LIMIT = 5
SEARCH_MAX_LIMIT = 20
SEARCH_MAX_QUERY_LENGTH = 100
SNIPPET_LENGTH = 120
# Characters of context kept before a match inside longer text.
SNIPPET_LEAD = 40


def _like_pattern(query: str) -> str:
    """`%query%` with LIKE wildcards in the query taken literally."""
    escaped = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def _contains(column: Any, pattern: str) -> ColumnElement[bool]:
    return column.ilike(pattern, escape="\\")


def _snippet(column: Any, query: str) -> ColumnElement[str]:
    """Up to SNIPPET_LENGTH characters of `column` around the first match, computed in SQL so long
    documents never leave the database."""
    position = func.strpos(func.lower(func.coalesce(column, "")), query.lower())
    start = func.greatest(position - SNIPPET_LEAD, 1)
    return func.substr(func.coalesce(column, ""), start, SNIPPET_LENGTH)


def _rank(column: Any, query: str) -> ColumnElement[int]:
    """0 when the label starts with the query, 1 when it contains it, 2 otherwise (body match)."""
    lowered = func.lower(column)
    needle = query.lower()
    return case(
        (func.strpos(lowered, needle) == 1, 0),
        (func.strpos(lowered, needle) > 0, 1),
        else_=2,
    )


def _clean(text: str | None) -> str | None:
    if not text:
        return None
    collapsed = " ".join(text.split())
    return collapsed or None


def _search_tasks(db: Session, user_id: uuid.UUID, query: str, limit: int) -> list[SearchResult]:
    pattern = _like_pattern(query)
    rows = db.execute(
        select(
            Task.id,
            Task.title,
            Task.due_date,
            Task.completed_at,
            BoardColumn.is_done,
            Board.id,
            Board.name,
            Board.color,
            case(
                (_contains(Task.title, pattern), null()),
                else_=_snippet(func.coalesce(Task.content_text, Task.description), query),
            ),
        )
        .join(BoardColumn, BoardColumn.id == Task.column_id)
        .join(Board, Board.id == BoardColumn.board_id)
        .where(
            board_access(user_id),
            Board.archived_at.is_(None),
            BoardColumn.archived_at.is_(None),
            Task.parent_task_id.is_(None),
            or_(
                _contains(Task.title, pattern),
                _contains(Task.content_text, pattern),
                _contains(Task.description, pattern),
            ),
        )
        .order_by(_rank(Task.title, query), BoardColumn.is_done, Task.due_date.desc(), Task.title, Task.id)
        .limit(limit + 1)
    ).all()
    return [
        SearchResult(
            type="task",
            id=task_id,
            label=title,
            secondary=_clean(snippet),
            board_id=board_id,
            board_name=board_name,
            board_color=board_color,
            due_date=due_date,
            is_done=bool(column_done or completed_at is not None),
        )
        for task_id, title, due_date, completed_at, column_done, board_id, board_name, board_color, snippet in rows
    ]


def _search_boards(db: Session, user_id: uuid.UUID, query: str, limit: int) -> list[SearchResult]:
    pattern = _like_pattern(query)
    rows = db.execute(
        select(Board.id, Board.name, Board.color, Board.user_id)
        .where(board_access(user_id), Board.archived_at.is_(None), _contains(Board.name, pattern))
        .order_by(_rank(Board.name, query), Board.position, Board.name, Board.id)
        .limit(limit + 1)
    ).all()
    return [
        SearchResult(
            type="board",
            id=board_id,
            label=name,
            board_id=board_id,
            board_name=name,
            board_color=color,
        )
        for board_id, name, color, _owner in rows
    ]


def _search_notes(db: Session, user_id: uuid.UUID, query: str, limit: int) -> list[SearchResult]:
    pattern = _like_pattern(query)
    rows = db.execute(
        select(
            Note.id,
            Note.title,
            case(
                (_contains(Note.title, pattern), func.substr(Note.body, 1, SNIPPET_LENGTH)),
                else_=_snippet(Note.body, query),
            ),
        )
        .where(Note.user_id == user_id, or_(_contains(Note.title, pattern), _contains(Note.body, pattern)))
        .order_by(_rank(Note.title, query), Note.is_pinned.desc(), Note.updated_at.desc(), Note.id)
        .limit(limit + 1)
    ).all()
    return [
        SearchResult(type="note", id=note_id, label=title, secondary=_clean(snippet))
        for note_id, title, snippet in rows
    ]


def _search_plans(db: Session, user_id: uuid.UUID, query: str, limit: int) -> list[SearchResult]:
    pattern = _like_pattern(query)
    rows = db.execute(
        select(Plan.id, Plan.name, func.substr(Plan.description, 1, SNIPPET_LENGTH))
        .where(Plan.user_id == user_id, or_(_contains(Plan.name, pattern), _contains(Plan.description, pattern)))
        .order_by(_rank(Plan.name, query), Plan.position, Plan.name, Plan.id)
        .limit(limit + 1)
    ).all()
    return [
        SearchResult(type="plan", id=plan_id, label=name, secondary=_clean(description))
        for plan_id, name, description in rows
    ]


_SEARCHERS = {
    "task": _search_tasks,
    "board": _search_boards,
    "note": _search_notes,
    "plan": _search_plans,
}


def search(
    db: Session,
    user_id: uuid.UUID,
    query: str,
    *,
    result_type: SearchType | None = None,
    limit: int = SEARCH_DEFAULT_LIMIT,
) -> SearchResponse:
    """Case-insensitive search over what the user can open: tasks and boards they own or share
    (active boards and statuses only), and their own notes and plans. ``limit`` applies per type."""
    text = " ".join(query.split())[:SEARCH_MAX_QUERY_LENGTH]
    if not text:
        return SearchResponse(query="", groups=[])
    safe_limit = min(max(limit, 1), SEARCH_MAX_LIMIT)
    types = (result_type,) if result_type else SEARCH_TYPES
    groups: list[SearchGroup] = []
    for kind in types:
        found = _SEARCHERS[kind](db, user_id, text, safe_limit)
        if found:
            groups.append(SearchGroup(type=kind, items=found[:safe_limit], has_more=len(found) > safe_limit))
    return SearchResponse(query=text, groups=groups)
