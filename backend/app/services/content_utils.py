from __future__ import annotations

from typing import Any

from app.services.url_validation import validate_content_src


def extract_text_from_content(content: dict[str, Any] | None) -> str:
    """Walk a Tiptap JSON doc and collect plain text for search/preview."""
    if not content:
        return ""

    parts: list[str] = []

    def walk(node: Any) -> None:
        if not isinstance(node, dict):
            return
        if node.get("type") == "text" and isinstance(node.get("text"), str):
            parts.append(node["text"])
        for child in node.get("content") or []:
            walk(child)

    walk(content)
    return " ".join(" ".join(parts).split())


def count_checklist_items(content: dict[str, Any] | None) -> tuple[int, int]:
    """Return (completed, total) taskItem counts from Tiptap JSON."""
    if not content:
        return 0, 0

    completed = 0
    total = 0

    def walk(node: Any) -> None:
        nonlocal completed, total
        if not isinstance(node, dict):
            return
        if node.get("type") == "taskItem":
            total += 1
            attrs = node.get("attrs") or {}
            if attrs.get("checked"):
                completed += 1
        for child in node.get("content") or []:
            walk(child)

    walk(content)
    return completed, total


def content_preview(content_text: str | None, description: str | None, limit: int = 140) -> str:
    source = (content_text or description or "").strip()
    if len(source) <= limit:
        return source
    return source[: limit - 1].rstrip() + "…"


def validate_content_urls(content: dict[str, Any] | None) -> None:
    """Reject dangerous protocols in Tiptap image src and link href values."""
    if not content:
        return

    def walk(node: Any) -> None:
        if not isinstance(node, dict):
            return
        node_type = node.get("type")
        attrs = node.get("attrs") or {}
        if node_type == "image":
            src = attrs.get("src")
            if src:
                validate_content_src(str(src))
        for mark in node.get("marks") or []:
            if not isinstance(mark, dict) or mark.get("type") != "link":
                continue
            href = (mark.get("attrs") or {}).get("href")
            if href:
                validate_content_src(str(href))
        for child in node.get("content") or []:
            walk(child)

    walk(content)


def description_to_paragraph_doc(description: str) -> dict[str, Any]:
    """Legacy plain description as a simple Tiptap paragraph document."""
    return {
        "type": "doc",
        "content": [
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": description}] if description else [],
            }
        ],
    }
