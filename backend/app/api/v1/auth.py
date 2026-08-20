from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.db.session import get_db
from app.schemas.auth import AuthResponse, CsrfResponse, LoginRequest, RegisterRequest, UserRead
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthResponse:
    return auth_service.register(db, payload, request, response)


@router.post("/login", response_model=AuthResponse)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> AuthResponse:
    return auth_service.login(db, payload, request, response)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, db: Session = Depends(get_db)) -> Response:
    auth_service.logout(db, request, response)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=UserRead)
def me(user: CurrentUser) -> UserRead:
    return auth_service.read_me(user)


@router.get("/csrf", response_model=CsrfResponse)
def csrf(request: Request, response: Response, user: CurrentUser, db: Session = Depends(get_db)) -> CsrfResponse:
    token = auth_service.issue_csrf(db, request, response)
    return CsrfResponse(csrf_token=token)
