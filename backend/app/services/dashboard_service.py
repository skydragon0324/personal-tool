from __future__ import annotations

from datetime import date

from sqlalchemy import and_, case, func, select
from sqlalchemy.orm import Session

from app.models import Board, BoardColumn, Task
from app.schemas.dashboard import (
    DashboardAttention,
    DashboardAttentionItem,
    DashboardBoardStats,
    DashboardPriorityCounts,
    DashboardSummary,
)

ATTENTION_LIMIT = 8


def _rate(completed: int, total: int) -> float:
    if total <= 0:
        return 0.0
    return round(completed / total, 4)


def get_dashboard_summary(db: Session, today: date) -> DashboardSummary:
    active_boards = list(
        db.scalars(
            select(Board).where(Board.archived_at.is_(None)).order_by(Board.position, Board.name)
        ).all()
    )
    board_ids = [board.id for board in active_boards]

    status_counts = dict(
        db.execute(
            select(BoardColumn.board_id, func.count(BoardColumn.id))
            .where(BoardColumn.board_id.in_(board_ids), BoardColumn.archived_at.is_(None))
            .group_by(BoardColumn.board_id)
        ).all()
    ) if board_ids else {}

    stats_rows = (
        db.execute(
            select(
                Board.id,
                func.count(Task.id),
                func.count(Task.id).filter(BoardColumn.is_done.is_(True)),
                func.count(Task.id).filter(
                    BoardColumn.is_done.is_(False),
                    Task.due_date < today,
                ),
                func.count(Task.id).filter(
                    BoardColumn.is_done.is_(False),
                    Task.due_date == today,
                ),
            )
            .select_from(Board)
            .outerjoin(
                BoardColumn,
                and_(
                    BoardColumn.board_id == Board.id,
                    BoardColumn.archived_at.is_(None),
                ),
            )
            .outerjoin(Task, Task.column_id == BoardColumn.id)
            .where(Board.archived_at.is_(None))
            .group_by(Board.id)
        ).all()
        if board_ids
        else []
    )
    stats_by_id = {
        board_id: {
            "total": int(total),
            "completed": int(completed),
            "overdue": int(overdue),
            "due_today": int(due_today),
        }
        for board_id, total, completed, overdue, due_today in stats_rows
    }

    priority_rows = (
        db.execute(
            select(Task.priority, func.count(Task.id))
            .select_from(Task)
            .join(BoardColumn, BoardColumn.id == Task.column_id)
            .join(Board, Board.id == BoardColumn.board_id)
            .where(
                Board.archived_at.is_(None),
                BoardColumn.archived_at.is_(None),
            )
            .group_by(Task.priority)
        ).all()
        if board_ids
        else []
    )
    priority = DashboardPriorityCounts()
    for name, count in priority_rows:
        if name == "high":
            priority.high = int(count)
        elif name == "medium":
            priority.medium = int(count)
        elif name == "low":
            priority.low = int(count)

    def attention_items(*, overdue: bool) -> list[DashboardAttentionItem]:
        due_filter = Task.due_date < today if overdue else Task.due_date == today
        rows = db.execute(
            select(Task, Board, BoardColumn)
            .join(BoardColumn, BoardColumn.id == Task.column_id)
            .join(Board, Board.id == BoardColumn.board_id)
            .where(
                Board.archived_at.is_(None),
                BoardColumn.archived_at.is_(None),
                BoardColumn.is_done.is_(False),
                due_filter,
            )
            .order_by(
                Task.due_date,
                case(
                    (Task.priority == "high", 0),
                    (Task.priority == "medium", 1),
                    else_=2,
                ),
                Task.title,
            )
            .limit(ATTENTION_LIMIT)
        ).all() if board_ids else []
        return [
            DashboardAttentionItem(
                id=task.id,
                title=task.title,
                due_date=task.due_date,
                priority=task.priority,
                board_id=board.id,
                board_name=board.name,
                status_id=column.id,
                status_name=column.name,
            )
            for task, board, column in rows
        ]

    boards: list[DashboardBoardStats] = []
    total_tasks = 0
    completed_tasks = 0
    overdue = 0
    due_today = 0
    for board in active_boards:
        stats = stats_by_id.get(
            board.id,
            {"total": 0, "completed": 0, "overdue": 0, "due_today": 0},
        )
        total = stats["total"]
        completed = stats["completed"]
        open_count = total - completed
        total_tasks += total
        completed_tasks += completed
        overdue += stats["overdue"]
        due_today += stats["due_today"]
        boards.append(
            DashboardBoardStats(
                id=board.id,
                name=board.name,
                color=board.color,
                icon_name=board.icon_name,
                total=total,
                open=open_count,
                completed=completed,
                completion_rate=_rate(completed, total),
                overdue=stats["overdue"],
                due_today=stats["due_today"],
                status_count=int(status_counts.get(board.id, 0)),
            )
        )

    return DashboardSummary(
        today=today,
        active_boards=len(active_boards),
        total_tasks=total_tasks,
        open_tasks=total_tasks - completed_tasks,
        completed_tasks=completed_tasks,
        completion_rate=_rate(completed_tasks, total_tasks),
        overdue=overdue,
        due_today=due_today,
        boards=boards,
        priority=priority,
        attention=DashboardAttention(
            overdue=attention_items(overdue=True),
            due_today=attention_items(overdue=False),
        ),
    )
