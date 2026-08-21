from datetime import date

from app.services.recurrence_dates import list_occurrence_dates, occurrence_index_for


class _Rule:
    def __init__(
        self,
        *,
        freq: str,
        interval: int = 1,
        weekdays: list[int] | None = None,
        month_day: int | None = None,
        dtstart: date,
        until_date: date | None = None,
        occurrence_limit: int | None = None,
    ) -> None:
        self.freq = freq
        self.interval = interval
        self.weekdays = weekdays or []
        self.month_day = month_day
        self.dtstart = dtstart
        self.until_date = until_date
        self.occurrence_limit = occurrence_limit


def test_daily_interval_and_until() -> None:
    rule = _Rule(freq="daily", interval=2, dtstart=date(2026, 8, 21), until_date=date(2026, 8, 27))
    assert list_occurrence_dates(rule, until=date(2026, 9, 1)) == [
        date(2026, 8, 21),
        date(2026, 8, 23),
        date(2026, 8, 25),
        date(2026, 8, 27),
    ]


def test_weekdays_skip_weekend() -> None:
    rule = _Rule(
        freq="weekly",
        weekdays=[0, 1, 2, 3, 4],
        dtstart=date(2026, 8, 21),  # Friday
        until_date=date(2026, 8, 26),
    )
    assert list_occurrence_dates(rule, until=date(2026, 8, 26)) == [
        date(2026, 8, 21),
        date(2026, 8, 24),
        date(2026, 8, 25),
        date(2026, 8, 26),
    ]


def test_weekly_friday_only() -> None:
    rule = _Rule(freq="weekly", weekdays=[4], dtstart=date(2026, 8, 21))
    dates = list_occurrence_dates(rule, until=date(2026, 9, 11))
    assert dates == [
        date(2026, 8, 21),
        date(2026, 8, 28),
        date(2026, 9, 4),
        date(2026, 9, 11),
    ]
    assert occurrence_index_for(rule, date(2026, 9, 4)) == 3


def test_monthly_skips_missing_31st() -> None:
    rule = _Rule(freq="monthly", month_day=31, dtstart=date(2026, 1, 31))
    dates = list_occurrence_dates(rule, until=date(2026, 5, 31))
    assert dates == [
        date(2026, 1, 31),
        date(2026, 3, 31),
        date(2026, 5, 31),
    ]


def test_yearly_leap_day_is_skipped_in_non_leap_years() -> None:
    rule = _Rule(freq="yearly", month_day=29, dtstart=date(2024, 2, 29))
    dates = list_occurrence_dates(rule, until=date(2029, 2, 28))
    assert dates == [date(2024, 2, 29), date(2028, 2, 29)]


def test_occurrence_limit_counts_from_dtstart() -> None:
    rule = _Rule(freq="daily", dtstart=date(2026, 8, 21), occurrence_limit=3)
    assert list_occurrence_dates(rule, until=date(2026, 9, 1), after=date(2026, 8, 22)) == [
        date(2026, 8, 22),
        date(2026, 8, 23),
    ]


def test_every_n_months() -> None:
    rule = _Rule(freq="monthly", interval=2, month_day=15, dtstart=date(2026, 1, 15))
    dates = list_occurrence_dates(rule, until=date(2026, 7, 15))
    assert dates == [
        date(2026, 1, 15),
        date(2026, 3, 15),
        date(2026, 5, 15),
        date(2026, 7, 15),
    ]
