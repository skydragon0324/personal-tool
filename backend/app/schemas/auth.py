from __future__ import annotations

import re
import uuid
from datetime import datetime
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field, field_validator

MIN_PASSWORD_LENGTH = 8
LOGIN_ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9._-]{2,31}$")
LOGIN_ID_INVALID = "Login ID must be 3-32 letters, numbers, dots, dashes or underscores"


def normalize_login_id(value: str) -> str:
    return value.strip().lower()


def validate_login_id(value: str) -> str:
    cleaned = normalize_login_id(value)
    if not LOGIN_ID_PATTERN.fullmatch(cleaned):
        raise ValueError(LOGIN_ID_INVALID)
    return cleaned


def validate_timezone(value: str) -> str:
    cleaned = value.strip() or "UTC"
    try:
        ZoneInfo(cleaned)
    except Exception as exc:
        raise ValueError("Invalid timezone") from exc
    return cleaned


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    login_id: str
    display_name: str
    timezone: str
    created_at: datetime


class RegisterRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=80)
    login_id: str
    password: str = Field(min_length=MIN_PASSWORD_LENGTH, max_length=1024)
    timezone: str = "UTC"

    @field_validator("display_name")
    @classmethod
    def _name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Name is required")
        return cleaned

    @field_validator("login_id")
    @classmethod
    def _login_id(cls, value: str) -> str:
        return validate_login_id(value)

    @field_validator("timezone")
    @classmethod
    def _timezone(cls, value: str) -> str:
        return validate_timezone(value)


class LoginRequest(BaseModel):
    login_id: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=1024)

    @field_validator("login_id")
    @classmethod
    def _login_id(cls, value: str) -> str:
        return normalize_login_id(value)


class ProfileUpdateRequest(BaseModel):
    """Fields left out are not changed. Changing the login ID needs the current password."""

    display_name: str | None = Field(default=None, min_length=1, max_length=80)
    login_id: str | None = None
    current_password: str | None = Field(default=None, max_length=1024)

    @field_validator("display_name")
    @classmethod
    def _name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Name is required")
        return cleaned

    @field_validator("login_id")
    @classmethod
    def _login_id(cls, value: str | None) -> str | None:
        return None if value is None else validate_login_id(value)


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=1024)
    new_password: str = Field(min_length=MIN_PASSWORD_LENGTH, max_length=1024)


class AuthResponse(BaseModel):
    user: UserRead
    csrf_token: str


class CsrfResponse(BaseModel):
    csrf_token: str
