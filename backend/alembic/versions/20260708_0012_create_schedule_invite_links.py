"""create schedule invite links

Revision ID: 20260708_0012
Revises: 20260708_0011
Create Date: 2026-07-08
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260708_0012"
down_revision: Union[str, None] = "20260708_0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "schedule_invite_links",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("schedule_id", sa.Integer(), nullable=False),
        sa.Column("created_by_user_id", sa.Integer(), nullable=False),
        sa.Column("invite_token", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_by_user_id", sa.Integer(), nullable=True),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.ForeignKeyConstraint(["accepted_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["schedule_id"], ["mission_schedules.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_schedule_invite_links_accepted_by_user_id"), "schedule_invite_links", ["accepted_by_user_id"], unique=False)
    op.create_index(op.f("ix_schedule_invite_links_created_by_user_id"), "schedule_invite_links", ["created_by_user_id"], unique=False)
    op.create_index(op.f("ix_schedule_invite_links_id"), "schedule_invite_links", ["id"], unique=False)
    op.create_index(op.f("ix_schedule_invite_links_invite_token"), "schedule_invite_links", ["invite_token"], unique=True)
    op.create_index(op.f("ix_schedule_invite_links_schedule_id"), "schedule_invite_links", ["schedule_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_schedule_invite_links_schedule_id"), table_name="schedule_invite_links")
    op.drop_index(op.f("ix_schedule_invite_links_invite_token"), table_name="schedule_invite_links")
    op.drop_index(op.f("ix_schedule_invite_links_id"), table_name="schedule_invite_links")
    op.drop_index(op.f("ix_schedule_invite_links_created_by_user_id"), table_name="schedule_invite_links")
    op.drop_index(op.f("ix_schedule_invite_links_accepted_by_user_id"), table_name="schedule_invite_links")
    op.drop_table("schedule_invite_links")
