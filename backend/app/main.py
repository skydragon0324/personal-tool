import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.error_codes import error_code

settings = get_settings()
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Life Management API",
    description="Personal workspace API for tasks, statuses, and daily planning.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


def _error_content(detail: object) -> dict:
    """The error body: the English ``detail`` plus, when known, the stable ``code`` and ``params``
    clients use to show the message in the user's language."""
    content: dict = {"detail": detail}
    if isinstance(detail, str):
        found = error_code(detail)
        if found is not None:
            content["code"], content["params"] = found
    return content


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content=_error_content(exc.detail), headers=exc.headers)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    errors = jsonable_encoder(exc.errors())
    content: dict = {"detail": errors, "code": "validation_failed", "params": {}}
    # Our validators raise ValueError("..."), which Pydantic reports as "Value error, ...".
    first = str(errors[0].get("msg", "")) if errors else ""
    found = error_code(first.removeprefix("Value error, "))
    if found is not None:
        content["code"], content["params"] = found
    return JSONResponse(status_code=422, content=content)


@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, exc: Exception) -> JSONResponse:
    if isinstance(exc, HTTPException):
        return JSONResponse(status_code=exc.status_code, content=_error_content(exc.detail))
    logger.exception("Unhandled error", exc_info=exc)
    content = _error_content("Internal server error")
    if settings.environment.lower() == "development":
        content["error"] = str(exc)
    return JSONResponse(status_code=500, content=content)
