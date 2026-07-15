"""add mission submission comments, likes, and winners

Revision ID: 20260713_0020
Revises: 20260713_0019
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260713_0020"
down_revision: Union[str, None] = "20260713_0019"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "schedule_missions",
        sa.Column("winner_user_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_schedule_missions_winner_user_id",
        "schedule_missions",
        "users",
        ["winner_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_schedule_missions_winner_user_id",
        "schedule_missions",
        ["winner_user_id"],
    )

    op.add_column(
        "mission_sessions",
        sa.Column("winner_user_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_mission_sessions_winner_user_id",
        "mission_sessions",
        "users",
        ["winner_user_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_table(
        "mission_submission_likes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("submission_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["submission_id"], ["mission_submissions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("submission_id", "user_id", name="uq_mission_submission_likes_submission_user"),
    )
    op.create_index("ix_mission_submission_likes_id", "mission_submission_likes", ["id"])
    op.create_index("ix_mission_submission_likes_submission_id", "mission_submission_likes", ["submission_id"])
    op.create_index("ix_mission_submission_likes_user_id", "mission_submission_likes", ["user_id"])

    op.create_table(
        "mission_submission_comments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("submission_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("content", sa.String(length=1000), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["submission_id"], ["mission_submissions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_mission_submission_comments_id", "mission_submission_comments", ["id"])
    op.create_index("ix_mission_submission_comments_submission_id", "mission_submission_comments", ["submission_id"])
    op.create_index("ix_mission_submission_comments_user_id", "mission_submission_comments", ["user_id"])

    op.drop_index("uq_mission_sessions_open_schedule_mission", table_name="mission_sessions")
    op.create_index(
        "uq_mission_sessions_open_schedule_mission",
        "mission_sessions",
        ["schedule_mission_id"],
        unique=True,
        postgresql_where=sa.text("status NOT IN ('COMPLETED', 'EXPIRED', 'VOTING')"),
    )


def downgrade() -> None:
    op.drop_index("uq_mission_sessions_open_schedule_mission", table_name="mission_sessions")
    op.create_index(
        "uq_mission_sessions_open_schedule_mission",
        "mission_sessions",
        ["schedule_mission_id"],
        unique=True,
        postgresql_where=sa.text("status NOT IN ('COMPLETED', 'EXPIRED')"),
    )
    op.drop_index("ix_mission_submission_comments_user_id", table_name="mission_submission_comments")
    op.drop_index("ix_mission_submission_comments_submission_id", table_name="mission_submission_comments")
    op.drop_index("ix_mission_submission_comments_id", table_name="mission_submission_comments")
    op.drop_table("mission_submission_comments")
    op.drop_index("ix_mission_submission_likes_user_id", table_name="mission_submission_likes")
    op.drop_index("ix_mission_submission_likes_submission_id", table_name="mission_submission_likes")
    op.drop_index("ix_mission_submission_likes_id", table_name="mission_submission_likes")
    op.drop_table("mission_submission_likes")
    op.drop_constraint("fk_mission_sessions_winner_user_id", "mission_sessions", type_="foreignkey")
    op.drop_column("mission_sessions", "winner_user_id")
    op.drop_index("ix_schedule_missions_winner_user_id", table_name="schedule_missions")
    op.drop_constraint("fk_schedule_missions_winner_user_id", "schedule_missions", type_="foreignkey")
    op.drop_column("schedule_missions", "winner_user_id")
