from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, field_validator

from app.schemas.auth import validate_login_id


class BoardPerson(BaseModel):
    """Someone who can work on a board; used for member lists and task assignees."""

    user_id: uuid.UUID
    display_name: str
    login_id: str
    role: Literal["owner", "member"]


class BoardMembersRead(BaseModel):
    """Owner first, then members by name."""

    people: list[BoardPerson]
    can_manage: bool


class BoardInvite(BaseModel):
    login_id: str

    @field_validator("login_id")
    @classmethod
    def _login_id(cls, value: str) -> str:
        return validate_login_id(value)


class BoardInviteResult(BaseModel):
    status: Literal["added"]
    members: BoardMembersRead
