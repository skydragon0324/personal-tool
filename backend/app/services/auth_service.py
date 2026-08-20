from __future__ import annotations

from datetime import UTC, datetime

from fastapi import HTTPException, Request, Response, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models import Board, User
from app.schemas.auth import AuthResponse, LoginRequest, RegisterRequest, UserRead
from app.services.board_service import seed_personal_board
from app.services.session_service import (
    LOGIN_ERROR,
    clear_session_cookies,
    create_session,
    delete_session,
    load_session,
    require_csrf,
    require_origin,
    rotate_csrf,
    set_csrf_cookie,
    set_session_cookies,
)


def _auth_response(user: User, csrf_token: str) -> AuthResponse:
    return AuthResponse(user=UserRead.model_validate(user), csrf_token=csrf_token)


def _issue_session(db: Session, user: User, response: Response) -> AuthResponse:
    _session, session_token, csrf_token = create_session(db, user)
    db.commit()
    db.refresh(user)
    set_session_cookies(response, session_token=session_token, csrf_token=csrf_token)
    return _auth_response(user, csrf_token)


def register(db: Session, payload: RegisterRequest, request: Request, response: Response) -> AuthResponse:
    require_origin(request)
    email = payload.email
    claimed = db.scalar(select(User).where(User.email == email, User.is_bootstrap.is_(False)))
    if claimed is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    try:
        bootstrap = db.scalar(select(User).where(User.is_bootstrap.is_(True)).with_for_update())
        if bootstrap is not None:
            taken = db.scalar(select(User).where(User.email == email, User.id != bootstrap.id))
            if taken is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Email already registered",
                )
            bootstrap.email = email
            bootstrap.display_name = payload.display_name
            bootstrap.password_hash = hash_password(payload.password)
            bootstrap.timezone = payload.timezone
            bootstrap.is_bootstrap = False
            bootstrap.updated_at = datetime.now(UTC)
            board_count = db.scalar(select(func.count(Board.id)).where(Board.user_id == bootstrap.id))
            if int(board_count or 0) == 0:
                seed_personal_board(db, bootstrap.id, payload.timezone)
            user = bootstrap
        else:
            user = User(
                email=email,
                display_name=payload.display_name,
                password_hash=hash_password(payload.password),
                timezone=payload.timezone,
                is_bootstrap=False,
            )
            db.add(user)
            db.flush()
            seed_personal_board(db, user.id, payload.timezone)
        return _issue_session(db, user, response)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        ) from None


def login(db: Session, payload: LoginRequest, request: Request, response: Response) -> AuthResponse:
    require_origin(request)
    user = db.scalar(select(User).where(User.email == payload.email))
    if (
        user is None
        or user.is_bootstrap
        or not verify_password(payload.password, user.password_hash)
    ):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=LOGIN_ERROR)
    return _issue_session(db, user, response)


def logout(db: Session, request: Request, response: Response) -> None:
    require_origin(request)
    loaded = load_session(db, request)
    if loaded is not None:
        _user, session = loaded
        require_csrf(request, session)
        delete_session(db, session)
        db.commit()
    clear_session_cookies(response)


def read_me(user: User) -> UserRead:
    return UserRead.model_validate(user)


def issue_csrf(db: Session, request: Request, response: Response) -> str:
    loaded = load_session(db, request)
    if loaded is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    _user, session = loaded
    token = rotate_csrf(db, session)
    db.commit()
    set_csrf_cookie(response, token)
    return token
