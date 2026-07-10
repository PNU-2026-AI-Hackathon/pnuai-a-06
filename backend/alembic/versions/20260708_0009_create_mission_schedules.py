"""create mission schedules

Revision ID: 20260708_0009
Revises: 20260706_0008
Create Date: 2026-07-08
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260708_0009"
down_revision: Union[str, None] = "20260706_0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "mission_schedules",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("creator_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["creator_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_mission_schedules_creator_id"), "mission_schedules", ["creator_id"], unique=False)
    op.create_index(op.f("ix_mission_schedules_id"), "mission_schedules", ["id"], unique=False)

    op.create_table(
        "schedule_members",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("schedule_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("invited_by_user_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["invited_by_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["schedule_id"], ["mission_schedules.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("schedule_id", "user_id", name="uq_schedule_members_schedule_user"),
    )
    op.create_index(op.f("ix_schedule_members_id"), "schedule_members", ["id"], unique=False)
    op.create_index(op.f("ix_schedule_members_invited_by_user_id"), "schedule_members", ["invited_by_user_id"], unique=False)
    op.create_index(op.f("ix_schedule_members_schedule_id"), "schedule_members", ["schedule_id"], unique=False)
    op.create_index(op.f("ix_schedule_members_user_id"), "schedule_members", ["user_id"], unique=False)

    op.create_table(
        "schedule_missions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("schedule_id", sa.Integer(), nullable=False),
        sa.Column("mission_id", sa.Integer(), nullable=False),
        sa.Column("added_by_user_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["added_by_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["mission_id"], ["missions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["schedule_id"], ["mission_schedules.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("schedule_id", "mission_id", name="uq_schedule_missions_schedule_mission"),
    )
    op.create_index(op.f("ix_schedule_missions_added_by_user_id"), "schedule_missions", ["added_by_user_id"], unique=False)
    op.create_index(op.f("ix_schedule_missions_id"), "schedule_missions", ["id"], unique=False)
    op.create_index(op.f("ix_schedule_missions_mission_id"), "schedule_missions", ["mission_id"], unique=False)
    op.create_index(op.f("ix_schedule_missions_schedule_id"), "schedule_missions", ["schedule_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_schedule_missions_schedule_id"), table_name="schedule_missions")
    op.drop_index(op.f("ix_schedule_missions_mission_id"), table_name="schedule_missions")
    op.drop_index(op.f("ix_schedule_missions_id"), table_name="schedule_missions")
    op.drop_index(op.f("ix_schedule_missions_added_by_user_id"), table_name="schedule_missions")
    op.drop_table("schedule_missions")

    op.drop_index(op.f("ix_schedule_members_user_id"), table_name="schedule_members")
    op.drop_index(op.f("ix_schedule_members_schedule_id"), table_name="schedule_members")
    op.drop_index(op.f("ix_schedule_members_invited_by_user_id"), table_name="schedule_members")
    op.drop_index(op.f("ix_schedule_members_id"), table_name="schedule_members")
    op.drop_table("schedule_members")

    op.drop_index(op.f("ix_mission_schedules_id"), table_name="mission_schedules")
    op.drop_index(op.f("ix_mission_schedules_creator_id"), table_name="mission_schedules")
    op.drop_table("mission_schedules")
