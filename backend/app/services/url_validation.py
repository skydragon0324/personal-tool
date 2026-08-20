from __future__ import annotations

import re
from urllib.parse import urlparse

from fastapi import HTTPException, status

_ALLOWED_SCHEMES = {"http", "https"}
_UNSAFE_SCHEME_RE = re.compile(r"^(javascript|data|vbscript|file|blob):", re.I)


def validate_http_url(url: str) -> str:
    cleaned = url.strip()
    if not cleaned:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="URL is required")
    if _UNSAFE_SCHEME_RE.match(cleaned):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unsafe URL")
    parsed = urlparse(cleaned)
    scheme = (parsed.scheme or "").lower()
    if scheme not in _ALLOWED_SCHEMES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only http and https URLs are allowed",
        )
    if not parsed.netloc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid URL")
    return cleaned


def validate_content_src(url: str) -> str:
    """Validate image/link URLs stored in Tiptap JSON."""
    return validate_http_url(url)
