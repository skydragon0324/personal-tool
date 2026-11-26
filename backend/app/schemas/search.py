from __future__ import annotations

import uuid
from datetime import date
from typing import Literal

from pydantic import BaseModel

SearchType = Literal["task", "board", "note", "plan"]


class SearchResult(BaseModel):
    """One hit in the command palette. The same shape for every type."""

    type: SearchType
    id: uuid.UUID
    # What the result is called (task title, board name, note title, plan name).
    label: str
    # Short context: a snippet of matching text, a note's first line, a plan's description.
    secondary: str | None = None
    # Navigation and context. A task opens on its board, so it carries the board.
    board_id: uuid.UUID | None = None
    board_name: str | None = None
    board_color: str | None = None
    due_date: date | None = None
    is_done: bool | None = None


class SearchGroup(BaseModel):
    type: SearchType
    items: list[SearchResult]
    # More matches exist than were returned for this type.
    has_more: bool


class SearchResponse(BaseModel):
    query: str
    groups: list[SearchGroup]
