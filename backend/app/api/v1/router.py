from fastapi import APIRouter

from app.api.v1 import boards, health, tasks

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(boards.router)
api_router.include_router(tasks.router)
