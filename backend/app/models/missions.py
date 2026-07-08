from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class MissionSet(Base):
    __tablename__ = "mission_sets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    theme: Mapped[str] = mapped_column(String(30), nullable=False, unique=True, index=True)
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    region_label: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    missions: Mapped[list["Mission"]] = relationship(
        back_populates="mission_set",
        cascade="all, delete-orphan",
    )


class Mission(Base):
    __tablename__ = "missions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    mission_set_id: Mapped[int] = mapped_column(
        ForeignKey("mission_sets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    code: Mapped[str] = mapped_column(String(30), nullable=False, unique=True, index=True)
    theme: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    district_code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    district_label: Mapped[str] = mapped_column(String(100), nullable=False)
    type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    unlock_condition: Mapped[str | None] = mapped_column(Text, nullable=True)
    verification_type: Mapped[str] = mapped_column(String(30), nullable=False)
    target_keyword: Mapped[str | None] = mapped_column(String(100), nullable=True)
    target_photo_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    target_photo_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    reward_item_name: Mapped[str] = mapped_column(String(100), nullable=False)
    reward_item_icon: Mapped[str] = mapped_column(String(20), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    mission_set: Mapped[MissionSet] = relationship(back_populates="missions")


class Basket(Base):
    __tablename__ = "baskets"
    __table_args__ = (
        UniqueConstraint("user_id", "theme", name="uq_baskets_user_theme"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    theme: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="EMPTY")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
