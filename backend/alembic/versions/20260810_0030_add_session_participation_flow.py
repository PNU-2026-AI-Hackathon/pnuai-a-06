"""add choose-participation mission session flow

Revision ID: 20260810_0030
Revises: 20260810_0029
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260810_0030"
down_revision: Union[str, None] = "20260810_0029"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "mission_sessions",
        sa.Column("participants_locked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "mission_sessions",
        sa.Column("shooting_deadline_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "mission_session_members",
        sa.Column(
            "participation_status",
            sa.String(length=30),
            server_default="UNDECIDED",
            nullable=False,
        ),
    )
    op.add_column(
        "mission_session_members",
        sa.Column("decision_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "mission_session_members",
        sa.Column("excluded_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "mission_session_members",
        sa.Column("exclusion_reason", sa.String(length=100), nullable=True),
    )
    op.add_column(
        "mission_session_members",
        sa.Column("upload_deadline_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_mission_session_members_participation_status",
        "mission_session_members",
        ["participation_status"],
    )

    op.execute(
        """
        UPDATE mission_sessions
        SET participants_locked_at = COALESCE(started_at, created_at)
        WHERE status NOT IN ('WAITING', 'READY')
        """
    )
    op.execute(
        """
        UPDATE mission_sessions
        SET shooting_deadline_at = COALESCE(started_at, created_at) + INTERVAL '60 seconds'
        WHERE status IN ('SHOOTING', 'UPLOADING')
        """
    )

    op.execute(
        """
        UPDATE mission_session_members AS member
        SET participation_status = CASE
            WHEN EXISTS (
                SELECT 1 FROM mission_sessions AS session
                WHERE session.id = member.session_id
                  AND session.status IN ('WAITING', 'READY')
            ) THEN 'UNDECIDED'
            WHEN EXISTS (
                SELECT 1 FROM mission_submissions AS submission
                WHERE submission.session_id = member.session_id
                  AND submission.user_id = member.user_id
                  AND submission.judge_status = 'PASSED'
            ) THEN 'COMPLETED'
            WHEN EXISTS (
                SELECT 1 FROM mission_sessions AS session
                WHERE session.id = member.session_id
                  AND session.status IN ('SHOOTING', 'UPLOADING')
            ) THEN 'PARTICIPATING'
            ELSE 'TIMED_OUT'
        END
        """
    )
    op.execute(
        """
        UPDATE mission_session_members AS member
        SET upload_deadline_at = session.shooting_deadline_at
        FROM mission_sessions AS session
        WHERE session.id = member.session_id
          AND member.participation_status = 'PARTICIPATING'
        """
    )

    op.drop_index("uq_mission_sessions_open_schedule_mission", table_name="mission_sessions")
    op.create_index(
        "uq_mission_sessions_open_schedule_mission",
        "mission_sessions",
        ["schedule_mission_id"],
        unique=True,
        postgresql_where=sa.text(
            "status NOT IN ('COMPLETED', 'EXPIRED', 'CANCELLED')"
        ),
    )


def downgrade() -> None:
    op.drop_index("uq_mission_sessions_open_schedule_mission", table_name="mission_sessions")
    op.create_index(
        "uq_mission_sessions_open_schedule_mission",
        "mission_sessions",
        ["schedule_mission_id"],
        unique=True,
        postgresql_where=sa.text("status NOT IN ('COMPLETED', 'EXPIRED', 'VOTING')"),
    )
    op.drop_index(
        "ix_mission_session_members_participation_status",
        table_name="mission_session_members",
    )
    op.drop_column("mission_session_members", "upload_deadline_at")
    op.drop_column("mission_session_members", "exclusion_reason")
    op.drop_column("mission_session_members", "excluded_at")
    op.drop_column("mission_session_members", "decision_at")
    op.drop_column("mission_session_members", "participation_status")
    op.drop_column("mission_sessions", "shooting_deadline_at")
    op.drop_column("mission_sessions", "participants_locked_at")
