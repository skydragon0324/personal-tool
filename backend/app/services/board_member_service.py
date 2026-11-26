"""Sharing boards with teammates.

The board owner (`Board.user_id`) can add existing users by their login ID. Members can work with
the board's tasks and assign them to anyone on the board; statuses, board settings and membership
stay with the owner.
"""

from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models import (
    Board,
    BoardColumn,
    BoardMember,
    Task,
    TaskAssignee,
    User,
)
from app.schemas.board_member import (
    BoardMembersRead,
    BoardInviteResult,
    BoardPerson,
)
from app.services.ownership import get_board_for_user


def _person(user: User, role: str) -> BoardPerson:
    return BoardPerson(user_id=user.id, display_name=user.display_name, login_id=user.login_id, role=role)


def participant_ids(db: Session, board: Board) -> set[uuid.UUID]:
    members = db.scalars(select(BoardMember.user_id).where(BoardMember.board_id == board.id)).all()
    return {board.user_id, *members}


def validate_assignees(db: Session, board_id: uuid.UUID, assignee_ids: set[uuid.UUID]) -> None:
    """A task can only be assigned to the board owner and its members."""
    if not assignee_ids:
        return
    board = db.get(Board, board_id)
    if board is None or not assignee_ids <= participant_ids(db, board):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Tasks can only be assigned to people on this board",
        )


def _read(db: Session, board: Board, viewer_id: uuid.UUID) -> BoardMembersRead:
    owner = db.get(User, board.user_id)
    assert owner is not None
    members = db.scalars(
        select(BoardMember)
        .join(User, User.id == BoardMember.user_id)
        .where(BoardMember.board_id == board.id)
        .order_by(func.lower(User.display_name))
    ).all()
    return BoardMembersRead(
        people=[_person(owner, "owner"), *(_person(member.user, "member") for member in members)],
        can_manage=board.user_id == viewer_id,
    )


def list_members(db: Session, user_id: uuid.UUID, board_id: uuid.UUID) -> BoardMembersRead:
    board = get_board_for_user(db, user_id, board_id)
    return _read(db, board, user_id)


def invite(db: Session, user_id: uuid.UUID, board_id: uuid.UUID, login_id: str) -> BoardInviteResult:
    from app.services.notification_service import notify_board_shared

    board = get_board_for_user(db, user_id, board_id, owner_only=True)
    invitee = db.scalar(
        select(User).where(func.lower(User.login_id) == login_id, User.is_bootstrap.is_(False))
    )
    if invitee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account with that login ID",
        )
    if invitee.id == board.user_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="You already own this board",
        )
    if invitee.id in participant_ids(db, board):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{invitee.display_name} is already on this board",
        )
    db.add(BoardMember(board_id=board.id, user_id=invitee.id, invited_by_user_id=user_id))
    owner = db.get(User, user_id)
    notify_board_shared(db, invitee.id, board, owner.display_name if owner else "Someone")
    db.commit()
    return BoardInviteResult(status="added", members=_read(db, board, user_id))


def _unassign(db: Session, board_id: uuid.UUID, user_id: uuid.UUID) -> None:
    task_ids = (
        select(Task.id)
        .join(BoardColumn, BoardColumn.id == Task.column_id)
        .where(BoardColumn.board_id == board_id)
    )
    db.execute(
        delete(TaskAssignee).where(TaskAssignee.user_id == user_id, TaskAssignee.task_id.in_(task_ids))
    )
    db.expire_all()


def remove_member(
    db: Session, user_id: uuid.UUID, board_id: uuid.UUID, member_user_id: uuid.UUID
) -> BoardMembersRead | None:
    """The owner can remove anyone; a member can remove themselves (leave the board)."""
    board = get_board_for_user(db, user_id, board_id, owner_only=member_user_id != user_id)
    member = db.scalar(
        select(BoardMember).where(
            BoardMember.board_id == board.id, BoardMember.user_id == member_user_id
        )
    )
    if member is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    _unassign(db, board.id, member_user_id)
    db.delete(member)
    db.commit()
    if member_user_id == user_id:
        return None
    return _read(db, board, user_id)
