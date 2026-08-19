from __future__ import annotations

import re
import uuid
from pathlib import Path
from typing import BinaryIO, Protocol

from fastapi import HTTPException, UploadFile, status

from app.core.config import Settings, get_settings

ALLOWED_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".pdf",
    ".txt",
    ".md",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".csv",
    ".zip",
}

ALLOWED_CONTENT_TYPES = {
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "application/pdf",
    "text/plain",
    "text/markdown",
    "text/csv",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
    "application/octet-stream",
}

IMAGE_CONTENT_TYPES = {"image/png", "image/jpeg", "image/gif", "image/webp"}


class StorageService(Protocol):
    def save(self, *, original_name: str, content_type: str, data: bytes) -> tuple[str, str, int]:
        """Return (storage_key, attachment_kind, size_bytes)."""

    def open(self, storage_key: str) -> Path:
        ...

    def delete(self, storage_key: str) -> None:
        ...


def safe_original_name(name: str) -> str:
    cleaned = Path(name).name.strip() or "file"
    cleaned = cleaned.replace("\x00", "")
    return cleaned[:255]


def validate_upload(filename: str, content_type: str, size: int, settings: Settings) -> str:
    if size <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file")
    if size > settings.max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds {settings.max_upload_bytes} bytes",
        )

    original = safe_original_name(filename)
    suffix = Path(original).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File extension '{suffix or '(none)'}' is not allowed",
        )

    normalized_type = (content_type or "application/octet-stream").split(";")[0].strip().lower()
    if normalized_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Content type '{normalized_type}' is not allowed",
        )
    return original


class LocalStorageService:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self.root = Path(self.settings.upload_dir).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _resolve_key(self, storage_key: str) -> Path:
        if ".." in storage_key.replace("\\", "/").split("/"):
            raise HTTPException(status_code=400, detail="Invalid storage key")
        if re.search(r"[\\/]", storage_key):
            raise HTTPException(status_code=400, detail="Invalid storage key")
        path = (self.root / storage_key).resolve()
        if not str(path).startswith(str(self.root)):
            raise HTTPException(status_code=400, detail="Invalid storage key")
        return path

    def save(self, *, original_name: str, content_type: str, data: bytes) -> tuple[str, str, int]:
        original = validate_upload(original_name, content_type, len(data), self.settings)
        suffix = Path(original).suffix.lower()
        storage_key = f"{uuid.uuid4().hex}{suffix}"
        path = self._resolve_key(storage_key)
        path.write_bytes(data)
        kind = "image" if content_type.split(";")[0].strip().lower() in IMAGE_CONTENT_TYPES else "file"
        return storage_key, kind, len(data)

    def open(self, storage_key: str) -> Path:
        path = self._resolve_key(storage_key)
        if not path.is_file():
            raise HTTPException(status_code=404, detail="File not found")
        return path

    def delete(self, storage_key: str) -> None:
        path = self._resolve_key(storage_key)
        if path.is_file():
            path.unlink()


async def read_upload_limited(upload: UploadFile, max_bytes: int) -> bytes:
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await upload.read(64 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File exceeds {max_bytes} bytes",
            )
        chunks.append(chunk)
    return b"".join(chunks)


def get_storage() -> LocalStorageService:
    return LocalStorageService()
