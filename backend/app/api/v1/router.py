from fastapi import APIRouter

from app.api.v1 import boards, columns, dashboard, health, notes, schedule, tasks

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(dashboard.router)
api_router.include_router(boards.router)
api_router.include_router(columns.router)
api_router.include_router(notes.router)
api_router.include_router(schedule.router)
api_router.include_router(tasks.router)
