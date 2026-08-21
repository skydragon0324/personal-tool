from __future__ import annotations

from calendar import monthrange
from datetime import date, timedelta
from typing import Protocol


class RecurrenceRule(Protocol):
    freq: str
    interval: int
    weekdays: list[int]
    month_day: int | None
    dtstart: date
    until_date: date | None
    occurrence_limit: int | None


def add_months(year: int, month: int, count: int) -> tuple[int, int]:
    total = year * 12 + (month - 1) + count
    return total // 12, total % 12 + 1


def occurrence_index_for(rule: RecurrenceRule, occurrence: date) -> int:
    dates = list_occurrence_dates(rule, until=occurrence)
    try:
        return dates.index(occurrence) + 1
    except ValueError:
        return len(dates) + 1


def list_occurrence_dates(
    rule: RecurrenceRule,
    *,
    until: date,
    after: date | None = None,
    limit: int | None = None,
) -> list[date]:
    """Return calendar occurrence start dates from dtstart through `until` inclusive.

    Dates that do not exist (31 Feb, 29 Feb in non-leap years) are skipped.
    `after` excludes dates strictly before that day when set.
    `limit` caps the number of returned dates after applying `after`.
    The series `occurrence_limit` still applies from dtstart.
    """
    cap = rule.occurrence_limit
    end = until
    if rule.until_date is not None and rule.until_date < end:
        end = rule.until_date
    if end < rule.dtstart:
        return []

    collected: list[date] = []
    for item in _iter_rule_dates(rule, end):
        if cap is not None and len(collected) >= cap:
            break
        collected.append(item)

    if after is not None:
        collected = [item for item in collected if item >= after]
    if limit is not None:
        collected = collected[:limit]
    return collected


def _iter_rule_dates(rule: RecurrenceRule, end: date):
    freq = rule.freq
    interval = max(int(rule.interval), 1)
    if freq == "daily":
        current = rule.dtstart
        while current <= end:
            yield current
            current += timedelta(days=interval)
        return

    if freq == "weekly":
        selected = sorted({int(day) for day in (rule.weekdays or []) if 0 <= int(day) <= 6})
        if not selected:
            selected = [rule.dtstart.weekday()]
        start_monday = rule.dtstart - timedelta(days=rule.dtstart.weekday())
        week = 0
        while True:
            monday = start_monday + timedelta(weeks=week * interval)
            if monday > end:
                break
            for weekday in selected:
                current = monday + timedelta(days=weekday)
                if current < rule.dtstart or current > end:
                    continue
                yield current
            week += 1
        return

    if freq == "monthly":
        day = rule.month_day or rule.dtstart.day
        offset = 0
        while True:
            year, month = add_months(rule.dtstart.year, rule.dtstart.month, offset * interval)
            last = monthrange(year, month)[1]
            if day <= last:
                current = date(year, month, day)
                if current > end:
                    break
                if current >= rule.dtstart:
                    yield current
            else:
                # Skip months that do not contain this day.
                probe = date(year, month, last)
                if probe > end and date(year, month, 1) > end:
                    break
            offset += 1
            if offset > 2400:
                break
        return

    if freq == "yearly":
        day = rule.month_day or rule.dtstart.day
        month = rule.dtstart.month
        offset = 0
        while True:
            year = rule.dtstart.year + offset * interval
            last = monthrange(year, month)[1]
            if day <= last:
                current = date(year, month, day)
                if current > end:
                    break
                if current >= rule.dtstart:
                    yield current
            elif date(year, month, 1) > end:
                break
            offset += 1
            if offset > 400:
                break
        return

    raise ValueError(f"Unsupported recurrence frequency: {freq}")
