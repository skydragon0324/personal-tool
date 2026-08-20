from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.security import generate_token, hash_token, tokens_match
from app.models import User, UserSession

SAFE_METHODS = {"GET", "HEAD", "OPTIONS", "TRACE"}
LOGIN_ERROR = "Invalid email or password"


def _cookie_kwargs(settings: Settings) -> dict[str, str | bool | int]:
    return {
        "httponly": True,
        "samesite": "lax",
        "path": "/",
        "secure": settings.use_secure_cookies,
        "max_age": settings.session_max_age_seconds,
    }


def set_csrf_cookie(
    response: Response,
    csrf_token: str,
    settings: Settings | None = None,
) -> None:
    settings = settings or get_settings()
    csrf_kwargs = {**_cookie_kwargs(settings), "httponly": False}
    response.set_cookie(settings.csrf_cookie_name, csrf_token, **csrf_kwargs)


def set_session_cookies(
    response: Response,
    *,
    session_token: str,
    csrf_token: str,
    settings: Settings | None = None,
) -> None:
    settings = settings or get_settings()
    session_kwargs = _cookie_kwargs(settings)
    response.set_cookie(settings.session_cookie_name, session_token, **session_kwargs)
    set_csrf_cookie(response, csrf_token, settings)


def clear_session_cookies(response: Response, settings: Settings | None = None) -> None:
    settings = settings or get_settings()
    for name in (settings.session_cookie_name, settings.csrf_cookie_name):
        response.delete_cookie(name, path="/", samesite="lax", secure=settings.use_secure_cookies)


def create_session(db: Session, user: User) -> tuple[UserSession, str, str]:
    settings = get_settings()
    session_token = generate_token()
    csrf_token = generate_token()
    now = datetime.now(UTC)
    session = UserSession(
        user_id=user.id,
        token_hash=hash_token(session_token),
        csrf_token_hash=hash_token(csrf_token),
        expires_at=now + timedelta(days=settings.session_ttl_days),
        last_seen_at=now,
    )
    db.add(session)
    db.flush()
    return session, session_token, csrf_token


def rotate_csrf(db: Session, session: UserSession) -> str:
    csrf_token = generate_token()
    session.csrf_token_hash = hash_token(csrf_token)
    session.last_seen_at = datetime.now(UTC)
    db.add(session)
    db.flush()
    return csrf_token


def load_session(db: Session, request: Request) -> tuple[User, UserSession] | None:
    settings = get_settings()
    raw = request.cookies.get(settings.session_cookie_name)
    if not raw:
        return None
    session = db.scalar(select(UserSession).where(UserSession.token_hash == hash_token(raw)))
    if session is None:
        return None
    now = datetime.now(UTC)
    if session.expires_at <= now:
        db.delete(session)
        db.flush()
        return None
    user = db.get(User, session.user_id)
    if user is None:
        db.delete(session)
        db.flush()
        return None
    session.last_seen_at = now
    return user, session


def require_origin(request: Request) -> None:
    if request.method.upper() in SAFE_METHODS:
        return
    origin = request.headers.get("origin")
    allowed = get_settings().cors_origin_list
    if origin not in allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid origin")


def require_csrf(request: Request, session: UserSession) -> None:
    if request.method.upper() in SAFE_METHODS:
        return
    settings = get_settings()
    token = request.headers.get(settings.csrf_header_name)
    if not token or not tokens_match(token, session.csrf_token_hash):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF check failed")


def delete_session(db: Session, session: UserSession) -> None:
    db.delete(session)
    db.flush()
