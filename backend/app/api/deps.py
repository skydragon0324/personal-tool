from __future__ import annotations

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from typing import Annotated

from app.db.session import get_db
from app.models.user import User
from app.services.session_service import load_session, require_csrf, require_origin


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    require_origin(request)
    loaded = load_session(db, request)
    if loaded is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    user, session = loaded
    require_csrf(request, session)
    db.add(session)
    db.commit()
    db.refresh(user)
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
