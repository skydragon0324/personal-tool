from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Index, Integer, String, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.board_column import BoardColumn
    from app.models.category import Category


class Board(Base):
    __tablename__ = "boards"
    __table_args__ = (
        UniqueConstraint("position", name="uq_boards_position"),
        Index("uq_boards_lower_name", text("lower(name)"), unique=True),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    timezone: Mapped[str] = mapped_column(String(50), nullable=False, default="UTC")
    color: Mapped[str] = mapped_column(String(32), nullable=False, default="teal")
    icon_name: Mapped[str | None] = mapped_column(String(40), nullable=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    columns: Mapped[list[BoardColumn]] = relationship(
        "BoardColumn",
        back_populates="board",
        cascade="all, delete-orphan",
        order_by="BoardColumn.position",
    )
    categories: Mapped[list[Category]] = relationship(
        "Category",
        back_populates="board",
        cascade="all, delete-orphan",
        order_by="Category.position",
    )
