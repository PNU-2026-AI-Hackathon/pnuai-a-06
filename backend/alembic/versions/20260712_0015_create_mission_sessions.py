"""create mission execution sessions and photo submissions

Revision ID: 20260712_0015
Revises: 20260708_0014
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260712_0015"
down_revision: Union[str, None] = "20260708_0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "mission_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("schedule_mission_id", sa.Integer(), nullable=False),
        sa.Column("created_by_user_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="WAITING"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revealed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["schedule_mission_id"], ["schedule_missions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_mission_sessions_id", "mission_sessions", ["id"])
    op.create_index("ix_mission_sessions_schedule_mission_id", "mission_sessions", ["schedule_mission_id"])
    op.create_index("ix_mission_sessions_created_by_user_id", "mission_sessions", ["created_by_user_id"])

    op.create_table(
        "mission_session_members",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("session_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("ready_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["session_id"], ["mission_sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("session_id", "user_id", name="uq_mission_session_members_session_user"),
    )
    op.create_index("ix_mission_session_members_id", "mission_session_members", ["id"])
    op.create_index("ix_mission_session_members_session_id", "mission_session_members", ["session_id"])
    op.create_index("ix_mission_session_members_user_id", "mission_session_members", ["user_id"])

    op.create_table(
        "mission_submissions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("session_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("storage_key", sa.String(length=500), nullable=False),
        sa.Column("photo_url", sa.String(length=1000), nullable=False),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["session_id"], ["mission_sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("session_id", "user_id", name="uq_mission_submissions_session_user"),
    )
    op.create_index("ix_mission_submissions_id", "mission_submissions", ["id"])
    op.create_index("ix_mission_submissions_session_id", "mission_submissions", ["session_id"])
    op.create_index("ix_mission_submissions_user_id", "mission_submissions", ["user_id"])


def downgrade() -> None:
    op.drop_table("mission_submissions")
    op.drop_table("mission_session_members")
    op.drop_table("mission_sessions")
