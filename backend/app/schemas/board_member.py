from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr


class BoardPerson(BaseModel):
    """Someone who can work on a board; used for member lists and task assignees."""

    user_id: uuid.UUID
    display_name: str
    email: str
    role: Literal["owner", "member"]


class BoardInvitationRead(BaseModel):
    id: uuid.UUID
    email: str
    created_at: datetime


class BoardMembersRead(BaseModel):
    """Owner first, then members by name. Pending invitations are only shown to the owner."""

    people: list[BoardPerson]
    invitations: list[BoardInvitationRead]
    can_manage: bool


class BoardInvite(BaseModel):
    email: EmailStr


class BoardInviteResult(BaseModel):
    status: Literal["added", "invited"]
    members: BoardMembersRead
