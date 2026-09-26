"""Sharing boards with teammates.

The board owner (`Board.user_id`) can add members by email. Someone without an account gets a
pending invitation that turns into a membership when they register with that email. Members can
work with the board's tasks and assign them to anyone on the board; statuses, board settings and
membership stay with the owner.
"""

from __future__ import annotations

import uuid

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from app.models import (
    Board,
    BoardColumn,
    BoardInvitation,
    BoardMember,
    Task,
    TaskAssignee,
    TaskRecurrenceSeries,
    User,
)
from app.schemas.board_member import (
    BoardInvitationRead,
    BoardMembersRead,
    BoardInviteResult,
    BoardPerson,
)
from app.services.ownership import get_board_for_user


def _person(user: User, role: str) -> BoardPerson:
    return BoardPerson(user_id=user.id, display_name=user.display_name, email=user.email, role=role)


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
    is_owner = board.user_id == viewer_id
    invitations = (
        db.scalars(
            select(BoardInvitation)
            .where(BoardInvitation.board_id == board.id)
            .order_by(BoardInvitation.created_at)
        ).all()
        if is_owner
        else []
    )
    return BoardMembersRead(
        people=[_person(owner, "owner"), *(_person(member.user, "member") for member in members)],
        invitations=[
            BoardInvitationRead(id=item.id, email=item.email, created_at=item.created_at)
            for item in invitations
        ],
        can_manage=is_owner,
    )


def list_members(db: Session, user_id: uuid.UUID, board_id: uuid.UUID) -> BoardMembersRead:
    board = get_board_for_user(db, user_id, board_id)
    return _read(db, board, user_id)


def invite(db: Session, user_id: uuid.UUID, board_id: uuid.UUID, email: str) -> BoardInviteResult:
    from app.services.notification_service import notify_board_shared

    board = get_board_for_user(db, user_id, board_id, owner_only=True)
    normalized = email.strip().lower()
    invitee = db.scalar(select(User).where(func.lower(User.email) == normalized))
    if invitee is not None:
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

    exists = db.scalar(
        select(BoardInvitation.id).where(
            BoardInvitation.board_id == board.id, BoardInvitation.email == normalized
        )
    )
    if exists is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{normalized} has already been invited",
        )
    db.add(BoardInvitation(board_id=board.id, email=normalized, invited_by_user_id=user_id))
    db.commit()
    return BoardInviteResult(status="invited", members=_read(db, board, user_id))


def _unassign(db: Session, board_id: uuid.UUID, user_id: uuid.UUID) -> None:
    task_ids = (
        select(Task.id)
        .join(BoardColumn, BoardColumn.id == Task.column_id)
        .where(BoardColumn.board_id == board_id)
    )
    db.execute(
        delete(TaskAssignee).where(TaskAssignee.user_id == user_id, TaskAssignee.task_id.in_(task_ids))
    )
    db.execute(
        update(TaskRecurrenceSeries)
        .where(
            TaskRecurrenceSeries.board_id == board_id,
            TaskRecurrenceSeries.assignee_ids.any(user_id),
        )
        .values(assignee_ids=func.array_remove(TaskRecurrenceSeries.assignee_ids, user_id))
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


def cancel_invitation(
    db: Session, user_id: uuid.UUID, board_id: uuid.UUID, invitation_id: uuid.UUID
) -> BoardMembersRead:
    board = get_board_for_user(db, user_id, board_id, owner_only=True)
    invitation = db.scalar(
        select(BoardInvitation).where(
            BoardInvitation.id == invitation_id, BoardInvitation.board_id == board.id
        )
    )
    if invitation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")
    db.delete(invitation)
    db.commit()
    return _read(db, board, user_id)


def accept_pending_invitations(db: Session, user: User) -> None:
    """Turn invitations for the user's email into memberships. Caller commits."""
    from app.services.notification_service import notify_board_shared

    invitations = db.scalars(
        select(BoardInvitation).where(BoardInvitation.email == user.email.strip().lower())
    ).all()
    for invitation in invitations:
        board = db.get(Board, invitation.board_id)
        if board is not None and board.user_id != user.id:
            db.add(
                BoardMember(
                    board_id=board.id,
                    user_id=user.id,
                    invited_by_user_id=invitation.invited_by_user_id,
                )
            )
            inviter = db.get(User, invitation.invited_by_user_id) if invitation.invited_by_user_id else None
            notify_board_shared(db, user.id, board, inviter.display_name if inviter else "Someone")
        db.delete(invitation)
    db.flush()
