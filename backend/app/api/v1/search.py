from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import CurrentUser
from app.db.session import get_db
from app.schemas.search import SearchResponse, SearchType
from app.services import search_service

router = APIRouter(prefix="/search", tags=["search"])


@router.get("", response_model=SearchResponse)
def search(
    user: CurrentUser,
    q: str = Query(default="", max_length=200, description="Text to look for (case-insensitive)"),
    type: SearchType | None = Query(default=None, description="Only this kind of result"),
    limit: int = Query(
        default=search_service.SEARCH_DEFAULT_LIMIT,
        ge=1,
        le=search_service.SEARCH_MAX_LIMIT,
        description="Most results per type",
    ),
    db: Session = Depends(get_db),
) -> SearchResponse:
    """Tasks, boards, notes and plans you can open whose names or text contain `q`."""
    return search_service.search(db, user.id, q, result_type=type, limit=limit)
