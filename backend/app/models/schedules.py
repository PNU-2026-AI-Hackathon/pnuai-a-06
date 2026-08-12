from datetime import date, datetime
from urllib.parse import quote

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    Float,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.core.config import get_settings
from app.models.missions import Mission
from app.models.users import User


def build_schedule_invite_url(invite_token: str) -> str | None:
    base_url = get_settings().schedule_invite_base_url.strip()
    if not base_url:
        return None

    encoded_token = quote(invite_token, safe="")
    if "{inviteToken}" in base_url:
        return base_url.replace("{inviteToken}", encoded_token)

    separator = "&" if "?" in base_url else "?"
    return f"{base_url}{separator}inviteToken={encoded_token}"


class MissionSchedule(Base):
    __tablename__ = "mission_schedules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    creator_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="ACTIVE")
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

    creator: Mapped[User] = relationship(foreign_keys=[creator_id])
    members: Mapped[list["ScheduleMember"]] = relationship(
        back_populates="schedule",
        cascade="all, delete-orphan",
    )
    schedule_missions: Mapped[list["ScheduleMission"]] = relationship(
        back_populates="schedule",
        cascade="all, delete-orphan",
    )

    @property
    def companions(self) -> list["ScheduleMember"]:
        return self.members

    @property
    def missions(self) -> list["ScheduleMission"]:
        return self.schedule_missions

    @property
    def participants(self) -> list[User]:
        """Creator plus accepted companions, with profile fields available to clients."""
        accepted_members = [member.user for member in self.members if member.status == "ACCEPTED"]
        return [self.creator, *accepted_members]


class UserScheduleOrder(Base):
    __tablename__ = "user_schedule_orders"
    __table_args__ = (
        UniqueConstraint("user_id", "schedule_id", name="uq_user_schedule_orders_user_schedule"),
        UniqueConstraint("user_id", "position", name="uq_user_schedule_orders_user_position"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    schedule_id: Mapped[int] = mapped_column(
        ForeignKey("mission_schedules.id", ondelete="CASCADE"), nullable=False, index=True
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)

    user: Mapped[User] = relationship()
    schedule: Mapped[MissionSchedule] = relationship()


class ScheduleMember(Base):
    __tablename__ = "schedule_members"
    __table_args__ = (
        UniqueConstraint("schedule_id", "user_id", name="uq_schedule_members_schedule_user"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    schedule_id: Mapped[int] = mapped_column(
        ForeignKey("mission_schedules.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    invited_by_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="PENDING")
    invite_email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    invite_token: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    invite_token_expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
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

    schedule: Mapped[MissionSchedule] = relationship(back_populates="members")
    user: Mapped[User] = relationship(foreign_keys=[user_id])
    invited_by: Mapped[User] = relationship(foreign_keys=[invited_by_user_id])

    @property
    def invite_url(self) -> str | None:
        return build_schedule_invite_url(self.invite_token)


class ScheduleInviteLink(Base):
    __tablename__ = "schedule_invite_links"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    schedule_id: Mapped[int] = mapped_column(
        ForeignKey("mission_schedules.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_by_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    invite_token: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="PENDING")
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    accepted_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
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

    schedule: Mapped[MissionSchedule] = relationship()
    created_by: Mapped[User] = relationship(foreign_keys=[created_by_user_id])
    accepted_by: Mapped[User | None] = relationship(foreign_keys=[accepted_by_user_id])

    @property
    def invite_url(self) -> str | None:
        return build_schedule_invite_url(self.invite_token)


class ScheduleMission(Base):
    __tablename__ = "schedule_missions"
    __table_args__ = (
        UniqueConstraint("schedule_id", "mission_id", name="uq_schedule_missions_schedule_mission"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    schedule_id: Mapped[int] = mapped_column(
        ForeignKey("mission_schedules.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    mission_id: Mapped[int] = mapped_column(
        ForeignKey("missions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    added_by_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    winner_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    planned_date: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="ADDED")
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

    schedule: Mapped[MissionSchedule] = relationship(back_populates="schedule_missions")
    mission: Mapped[Mission] = relationship()
    added_by: Mapped[User] = relationship(foreign_keys=[added_by_user_id])
    winner: Mapped[User | None] = relationship(foreign_keys=[winner_user_id])

    sessions: Mapped[list["MissionSession"]] = relationship(
        back_populates="schedule_mission",
        cascade="all, delete-orphan",
    )


class MissionSession(Base):
    __tablename__ = "mission_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    schedule_mission_id: Mapped[int] = mapped_column(
        ForeignKey("schedule_missions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_by_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="WAITING")
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    participants_locked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    shooting_deadline_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    revealed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    voting_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    winner_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    schedule_mission: Mapped[ScheduleMission] = relationship(back_populates="sessions")
    created_by: Mapped[User] = relationship(foreign_keys=[created_by_user_id])
    winner: Mapped[User | None] = relationship(foreign_keys=[winner_user_id])
    members: Mapped[list["MissionSessionMember"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
    submissions: Mapped[list["MissionSubmission"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )

    @property
    def mission(self) -> Mission:
        return self.schedule_mission.mission

    @property
    def session_id(self) -> int:
        return self.id


class MissionSessionMember(Base):
    __tablename__ = "mission_session_members"
    __table_args__ = (
        UniqueConstraint("session_id", "user_id", name="uq_mission_session_members_session_user"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("mission_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ready_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    participation_status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="UNDECIDED", server_default="UNDECIDED", index=True
    )
    decision_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    excluded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    exclusion_reason: Mapped[str | None] = mapped_column(String(100), nullable=True)
    upload_deadline_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    session: Mapped[MissionSession] = relationship(back_populates="members")
    user: Mapped[User] = relationship()


class MissionSubmission(Base):
    __tablename__ = "mission_submissions"
    __table_args__ = (
        UniqueConstraint("session_id", "user_id", name="uq_mission_submissions_session_user"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("mission_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)
    photo_url: Mapped[str] = mapped_column(String(1000), nullable=False)
    captured_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    judge_status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="PENDING", server_default="PENDING", index=True
    )
    similarity_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    judge_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    judge_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    judged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    judge_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    session: Mapped[MissionSession] = relationship(back_populates="submissions")
    user: Mapped[User] = relationship()
    likes: Mapped[list["MissionSubmissionLike"]] = relationship(
        back_populates="submission", cascade="all, delete-orphan"
    )
    comments: Mapped[list["MissionSubmissionComment"]] = relationship(
        back_populates="submission", cascade="all, delete-orphan"
    )

    @property
    def like_count(self) -> int:
        return len(self.likes)


class MissionSubmissionLike(Base):
    __tablename__ = "mission_submission_likes"
    __table_args__ = (
        UniqueConstraint("session_id", "user_id", name="uq_mission_submission_likes_session_user"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    submission_id: Mapped[int] = mapped_column(
        ForeignKey("mission_submissions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    session_id: Mapped[int] = mapped_column(
        ForeignKey("mission_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    submission: Mapped[MissionSubmission] = relationship(back_populates="likes")
    user: Mapped[User] = relationship()


class MissionSubmissionComment(Base):
    __tablename__ = "mission_submission_comments"
    __table_args__ = (
        UniqueConstraint(
            "submission_id",
            "user_id",
            name="uq_mission_submission_comments_submission_user",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    submission_id: Mapped[int] = mapped_column(
        ForeignKey("mission_submissions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    content: Mapped[str] = mapped_column(String(1000), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    submission: Mapped[MissionSubmission] = relationship(back_populates="comments")
    user: Mapped[User] = relationship()
