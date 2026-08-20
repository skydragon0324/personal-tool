"""Deterministic seed IDs for the default personal board."""

from uuid import UUID

DEFAULT_BOARD_ID = UUID("a0000000-0000-4000-8000-000000000001")
COLUMN_TODO_ID = UUID("a0000000-0000-4000-8000-000000000011")
COLUMN_IN_PROGRESS_ID = UUID("a0000000-0000-4000-8000-000000000012")
COLUMN_DONE_ID = UUID("a0000000-0000-4000-8000-000000000013")

UNCATEGORIZED_NAME = "Uncategorized"
DEFAULT_CATEGORY_COLOR = "teal"
UNCATEGORIZED_COLOR = "gray"
DEFAULT_BOARD_COLOR = "teal"
DEFAULT_BOARD_ICON = "home"
BOARD_ICONS = (
    "home",
    "briefcase",
    "users",
    "heart",
    "star",
    "flag",
    "bookmark",
    "calendar",
)
DEFAULT_BOARD_COLUMNS = (
    ("To Do", "slate", False),
    ("In Progress", "blue", False),
    ("Done", "teal", True),
)
CATEGORY_COLORS = (
    "gray",
    "slate",
    "teal",
    "blue",
    "indigo",
    "violet",
    "pink",
    "red",
    "orange",
    "yellow",
    "lime",
    "green",
    "cyan",
)
