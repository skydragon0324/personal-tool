from fastapi import APIRouter

from app.api.v1 import (
    auth,
    boards,
    calendar,
    columns,
    dashboard,
    health,
    notes,
    notifications,
    plans,
    schedule,
    search,
    tasks,
    today,
    workspace,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(dashboard.router)
api_router.include_router(calendar.router)
api_router.include_router(search.router)
api_router.include_router(today.router)
api_router.include_router(workspace.router)
api_router.include_router(boards.router)
api_router.include_router(columns.router)
api_router.include_router(notes.router)
api_router.include_router(notifications.router)
api_router.include_router(plans.router)
api_router.include_router(schedule.router)
api_router.include_router(tasks.router)
