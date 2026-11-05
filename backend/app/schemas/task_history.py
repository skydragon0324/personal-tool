from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class TaskHistoryRead(BaseModel):
    id: uuid.UUID
    created_at: datetime
    actor_id: uuid.UUID | None
    actor_name: str
    # "created" or "updated"
    action: str
    # Each change: {"field", "from", "to"} for single values, {"field", "added", "removed"} for
    # lists (assignees, subtasks, links, files) and just {"field"} for the details text.
    changes: list[dict[str, Any]]
