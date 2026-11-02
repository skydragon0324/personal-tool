"""Stable codes for the error messages the API sends, so clients can show them in any language.

Errors keep their English ``detail`` (existing clients and logs rely on it). The exception
handlers in ``app.main`` add ``code`` and ``params`` next to it by matching the message against
this registry. Templates use ``{name}`` for the parts that vary; those parts come back in
``params``. Every message the API can send must be listed here (a test checks this).
"""

from __future__ import annotations

import re

ERROR_MESSAGES: dict[str, str] = {
    # Authentication and access
    "not_authenticated": "Not authenticated",
    "invalid_login": "Invalid email or password",
    "email_already_registered": "Email already registered",
    "csrf_failed": "CSRF check failed",
    "invalid_origin": "Invalid origin",
    "owner_only": "Only the board owner can do this",
    # Not found
    "board_not_found": "Board not found",
    "task_not_found": "Task not found",
    "subtask_not_found": "Subtask not found",
    "status_not_found": "Status not found",
    "column_not_found": "Column not found",
    "category_not_found": "Category not found",
    "attachment_not_found": "Attachment not found",
    "file_not_found": "File not found",
    "note_not_found": "Note not found",
    "notification_not_found": "Notification not found",
    "schedule_entry_not_found": "Schedule entry not found",
    "recurrence_series_not_found": "Recurrence series not found",
    "member_not_found": "Member not found",
    "invitation_not_found": "Invitation not found",
    "plan_not_found": "Plan not found",
    "plan_day_not_found": "Day not found",
    "plan_item_not_found": "Item not found",
    "not_found": "{label} not found",
    # Boards and sharing
    "board_name_taken": "A board with that name already exists",
    "board_name_exists": "A board named \"{name}\" already exists",
    "board_name_required": "Board name is required",
    "last_active_board": "The last active board cannot be archived",
    "archived_boards_not_reorderable": "Archived boards cannot be reordered",
    "active_board_not_deletable": "Active boards cannot be deleted. Archive the board first.",
    "board_files_not_deleted": "Could not delete board files",
    "already_own_board": "You already own this board",
    "already_member": "{name} is already on this board",
    "already_invited": "{email} has already been invited",
    "assignee_not_on_board": "Tasks can only be assigned to people on this board",
    # Statuses and categories
    "status_has_tasks": "This status still has tasks. Move them to another status before archiving.",
    "status_with_tasks_not_deletable": "Statuses with tasks cannot be deleted",
    "last_active_status": "The last active status cannot be archived",
    "archived_statuses_not_reorderable": "Archived statuses cannot be reordered",
    "choose_active_status": "Choose a valid active status to move tasks into",
    "status_name_required": "Status name is required",
    "status_names_unique": "Status names must be unique",
    "status_count_range": "Provide between 1 and 20 statuses",
    "completed_status_required": "At least one status must count as completed",
    "category_required": "Category is required",
    "category_name_required": "Category name is required",
    "category_name_exists": "A category named \"{name}\" already exists on this board",
    "invalid_color": "Color must be one of: {options}",
    "invalid_icon": "Icon must be one of: {options}",
    "category_other_board": "Category does not belong to the same board as the task",
    "uncategorized_missing": "Uncategorized category is missing for this board",
    "category_id_null": "category_id cannot be null",
    # Tasks and moving
    "task_version_stale": "Task version is stale; refresh and try again",
    "anchor_not_in_list": "Anchor item is not in the target list",
    "start_after_due": "start_date must be on or before due_date",
    "title_required": "Title is required",
    "name_required": "Name is required",
    "text_required": "Text is required",
    "field_required": "{field} is required",
    "priority_required": "Priority is required",
    "move_into_archived_status": "Cannot move a task into an archived status",
    "place_in_archived_status": "Cannot place a task in an archived status",
    "move_to_other_board_status": "Cannot move a task to a status on another board",
    "move_same_status": "Tasks cannot be moved into the same status",
    "move_to_archived_board": "Tasks cannot be moved to an archived board",
    "task_already_on_board": "The task is already on this board",
    "target_board_no_statuses": "The target board has no statuses yet",
    "choose_target_status": "Choose an active status on the target board",
    "no_completed_status": "This board has no completed status to move the task to",
    "subtask_cannot_repeat": "A sub-task cannot repeat",
    "subtask_no_nesting": "A sub-task cannot have its own sub-tasks",
    "subtask_title_required": "Subtask title is required",
    "move_parent_instead": "Move the parent task to move its sub-tasks",
    "remind_at_needs_timezone": "remind_at must include a timezone offset",
    "pick_future_time": "Pick a time in the future",
    "not_about_task": "This notification is not about a task",
    # Board view
    "date_range_required": "Both start_date and end_date are required",
    "end_before_start": "end_date must be on or after start_date",
    "date_range_too_long": "Date range cannot exceed {days} days",
    "invalid_date_field": "date_field must be due_date or created_at",
    # Repeating tasks
    "invalid_edit_scope": "Invalid edit_scope",
    "invalid_delete_scope": "Invalid delete_scope",
    "confirm_completed_delete": "Deleting a completed repeating task requires confirm_completed=true",
    "rule_change_needs_scope": (
        "Changing the repeat rule requires This and following tasks or All tasks in the series"
    ),
    "yearly_month_series": (
        "Yearly month cannot be changed for the entire series because it is stored as the series "
        "start date. Use This and following tasks to start a new yearly series."
    ),
    "series_version_stale": "Recurrence series version is stale; refresh and try again",
    "no_occurrence_date": "Recurrence rule has no available occurrence date for this task",
    "until_before_first": "until_date must be on or after the first occurrence",
    "until_or_limit": "Use either until_date or occurrence_limit, not both",
    "weekly_needs_weekday": "Weekly recurrence requires at least one weekday",
    "weekdays_range": "Weekdays must be values from 0 (Monday) to 6 (Sunday)",
    "weekdays_unique": "Weekdays must be unique values from 0 (Monday) to 6 (Sunday)",
    "dtstart_required": "dtstart is required",
    "duration_days_required": "duration_days is required",
    "unsupported_frequency": "Unsupported recurrence frequency: {freq}",
    "use_stop_endpoint": "Use the stop endpoint to pause a recurring series",
    "generate_end_before_start": "Generate end date must be on or after start date",
    "resume_no_status": "Recurrence cannot resume because the starting status is unavailable",
    "resume_no_occurrence": "Recurrence cannot resume because there is no remaining occurrence",
    "resume_category_missing": "Recurrence cannot resume because the category is not on this board",
    "resume_board_unavailable": "Recurrence cannot resume because the board is archived or unavailable",
    "generate_unavailable": (
        "Recurrence cannot generate because the board or starting status is unavailable"
    ),
    "archived_board_recurring": "Recurring tasks on an archived board cannot be edited",
    "archived_series_stop": "Archived recurrence series cannot be stopped",
    "archived_series_resume": "Archived recurrence series cannot be resumed",
    "archived_series_edit": "Archived recurrence series cannot be edited",
    "start_status_other_board": "Starting status does not belong to this board",
    "start_status_archived": "Cannot use an archived status as the starting status",
    "start_status_completed": "Cannot use a completed status as the starting status",
    # Schedule and plans
    "end_time_after_start": "end_time must be later than start_time",
    "week_start_required": "week_start is required for this-week entries",
    "week_start_monday": "week_start must be a Monday",
    "not_on_this_date": "Schedule does not occur on this date",
    "plan_day_taken": "This plan already has that day",
    # Files and links
    "empty_file": "Empty file",
    "file_too_large": "File exceeds {bytes} bytes",
    "extension_not_allowed": "File extension '{extension}' is not allowed",
    "content_type_not_allowed": "Content type '{type}' is not allowed",
    "invalid_storage_key": "Invalid storage key",
    "url_required": "URL is required",
    "invalid_url": "Invalid URL",
    "unsafe_url": "Unsafe URL",
    "http_urls_only": "Only http and https URLs are allowed",
    # Settings
    "invalid_timezone": "Invalid timezone",
    "timezone_not_valid": "Timezone is not valid",
    "setting_not_null": "{key} cannot be null",
    # Fallbacks
    "validation_failed": "Some of the values are not valid",
    "internal_error": "Internal server error",
}


def _compile(template: str) -> re.Pattern[str]:
    pattern = ""
    for literal, name in re.findall(r"([^{]*)(?:\{(\w+)\})?", template):
        pattern += re.escape(literal)
        if name:
            pattern += f"(?P<{name}>.+?)"
    return re.compile(f"^{pattern}$")


# Exact messages first so a template like "{key} cannot be null" never shadows a fixed message.
_EXACT = {message: code for code, message in ERROR_MESSAGES.items() if "{" not in message}
_TEMPLATES = [
    (code, _compile(message)) for code, message in ERROR_MESSAGES.items() if "{" in message
]


def error_code(message: str) -> tuple[str, dict[str, str]] | None:
    """The code and parameters for an API error message, or None if it is not registered."""
    message = message.strip()
    if message in _EXACT:
        return _EXACT[message], {}
    for code, pattern in _TEMPLATES:
        found = pattern.match(message)
        if found:
            return code, found.groupdict()
    return None
