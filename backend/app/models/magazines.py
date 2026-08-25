from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ScheduleMagazine(Base):
    __tablename__ = "schedule_magazines"
    __table_args__ = (
        UniqueConstraint(
            "schedule_id",
            "template_key",
            name="uq_schedule_magazines_schedule_template",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    schedule_id: Mapped[int] = mapped_column(
        ForeignKey("mission_schedules.id", ondelete="CASCADE"), nullable=False, index=True
    )
    template_key: Mapped[str] = mapped_column(String(100), nullable=False)
    locale: Mapped[str] = mapped_column(String(10), nullable=False, default="ko")
    template_version: Mapped[int] = mapped_column(Integer, nullable=False)
    generation_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        unique=True,
        server_default=text("nextval('magazine_generation_number_seq')"),
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="GENERATING")
    source_fingerprint: Mapped[str | None] = mapped_column(String(64), nullable=True)
    image_urls: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    source_snapshot: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
