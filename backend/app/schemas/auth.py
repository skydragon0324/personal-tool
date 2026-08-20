from __future__ import annotations

import uuid
from datetime import datetime
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

MIN_PASSWORD_LENGTH = 10


def normalize_email(value: str) -> str:
    return value.strip().lower()


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
    email: str
    display_name: str
    timezone: str
    created_at: datetime


class RegisterRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    password: str = Field(min_length=MIN_PASSWORD_LENGTH, max_length=1024)
    timezone: str = "UTC"

    @field_validator("display_name")
    @classmethod
    def _name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Name is required")
        return cleaned

    @field_validator("email")
    @classmethod
    def _email(cls, value: EmailStr) -> str:
        return normalize_email(str(value))

    @field_validator("timezone")
    @classmethod
    def _timezone(cls, value: str) -> str:
        return validate_timezone(value)


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=1024)

    @field_validator("email")
    @classmethod
    def _email(cls, value: str) -> str:
        return normalize_email(value)


class AuthResponse(BaseModel):
    user: UserRead
    csrf_token: str


class CsrfResponse(BaseModel):
    csrf_token: str
