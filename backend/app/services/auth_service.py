from __future__ import annotations

from datetime import UTC, datetime

from fastapi import HTTPException, Request, Response, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models import Board, User, UserSession
from app.schemas.auth import (
    AuthResponse,
    LoginRequest,
    PasswordChangeRequest,
    ProfileUpdateRequest,
    RegisterRequest,
    UserRead,
)
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


LOGIN_ID_TAKEN = "Login ID already taken"


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
    login_id = payload.login_id
    claimed = db.scalar(select(User).where(User.login_id == login_id, User.is_bootstrap.is_(False)))
    if claimed is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=LOGIN_ID_TAKEN)

    try:
        bootstrap = db.scalar(select(User).where(User.is_bootstrap.is_(True)).with_for_update())
        if bootstrap is not None:
            taken = db.scalar(select(User).where(User.login_id == login_id, User.id != bootstrap.id))
            if taken is not None:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=LOGIN_ID_TAKEN)
            bootstrap.login_id = login_id
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
                login_id=login_id,
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
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=LOGIN_ID_TAKEN) from None


def login(db: Session, payload: LoginRequest, request: Request, response: Response) -> AuthResponse:
    require_origin(request)
    user = db.scalar(select(User).where(User.login_id == payload.login_id))
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


CURRENT_PASSWORD_REQUIRED = "Enter your current password to change your login ID"
CURRENT_PASSWORD_WRONG = "Current password is incorrect"


def _check_current_password(user: User, password: str | None) -> None:
    if not password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=CURRENT_PASSWORD_REQUIRED)
    if not verify_password(password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=CURRENT_PASSWORD_WRONG)


def update_profile(db: Session, user: User, payload: ProfileUpdateRequest) -> UserRead:
    if payload.display_name is not None:
        user.display_name = payload.display_name
    if payload.login_id is not None and payload.login_id != user.login_id:
        _check_current_password(user, payload.current_password)
        taken = db.scalar(
            select(User.id).where(func.lower(User.login_id) == payload.login_id, User.id != user.id)
        )
        if taken is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=LOGIN_ID_TAKEN)
        user.login_id = payload.login_id
    user.updated_at = datetime.now(UTC)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=LOGIN_ID_TAKEN) from None
    db.refresh(user)
    return UserRead.model_validate(user)


def change_password(db: Session, request: Request, user: User, payload: PasswordChangeRequest) -> None:
    """Sets a new password and signs out every other session of the user; this one stays."""
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=CURRENT_PASSWORD_WRONG)
    user.password_hash = hash_password(payload.new_password)
    user.updated_at = datetime.now(UTC)
    loaded = load_session(db, request)
    others = select(UserSession).where(UserSession.user_id == user.id)
    if loaded is not None:
        others = others.where(UserSession.id != loaded[1].id)
    for session in db.scalars(others).all():
        db.delete(session)
    db.commit()


def issue_csrf(db: Session, request: Request, response: Response) -> str:
    loaded = load_session(db, request)
    if loaded is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    _user, session = loaded
    token = rotate_csrf(db, session)
    db.commit()
    set_csrf_cookie(response, token)
    return token
