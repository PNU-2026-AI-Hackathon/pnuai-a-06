"""add schedule invite tokens

Revision ID: 20260708_0011
Revises: 20260708_0010
Create Date: 2026-07-08
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260708_0011"
down_revision: Union[str, None] = "20260708_0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("schedule_members", sa.Column("invite_email", sa.String(length=255), nullable=True))
    op.add_column("schedule_members", sa.Column("invite_token", sa.String(length=255), nullable=True))
    op.add_column(
        "schedule_members",
        sa.Column("invite_token_expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute(
        "UPDATE schedule_members "
        "SET invite_email = COALESCE(users.email, 'user-' || users.id::text || '@local.invalid') "
        "FROM users WHERE schedule_members.user_id = users.id"
    )
    op.execute("UPDATE schedule_members SET invite_token = md5(random()::text || clock_timestamp()::text || id::text)")
    op.execute("UPDATE schedule_members SET invite_token_expires_at = now() + interval '14 days'")
    op.alter_column("schedule_members", "invite_email", nullable=False)
    op.alter_column("schedule_members", "invite_token", nullable=False)
    op.alter_column("schedule_members", "invite_token_expires_at", nullable=False)
    op.create_index(op.f("ix_schedule_members_invite_email"), "schedule_members", ["invite_email"], unique=False)
    op.create_index(op.f("ix_schedule_members_invite_token"), "schedule_members", ["invite_token"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_schedule_members_invite_token"), table_name="schedule_members")
    op.drop_index(op.f("ix_schedule_members_invite_email"), table_name="schedule_members")
    op.drop_column("schedule_members", "invite_token_expires_at")
    op.drop_column("schedule_members", "invite_token")
    op.drop_column("schedule_members", "invite_email")
