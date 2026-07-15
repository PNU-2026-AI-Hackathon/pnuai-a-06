"""add per-user schedule ordering and planned mission dates

Revision ID: 20260715_0026
Revises: 20260715_0025
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260715_0026"
down_revision: Union[str, None] = "20260715_0025"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("schedule_missions", sa.Column("planned_date", sa.Date(), nullable=True))
    op.create_index("ix_schedule_missions_planned_date", "schedule_missions", ["planned_date"])
    op.create_table(
        "user_schedule_orders",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("schedule_id", sa.Integer(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["schedule_id"], ["mission_schedules.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "schedule_id", name="uq_user_schedule_orders_user_schedule"),
        sa.UniqueConstraint("user_id", "position", name="uq_user_schedule_orders_user_position"),
    )
    op.create_index("ix_user_schedule_orders_id", "user_schedule_orders", ["id"])
    op.create_index("ix_user_schedule_orders_user_id", "user_schedule_orders", ["user_id"])
    op.create_index("ix_user_schedule_orders_schedule_id", "user_schedule_orders", ["schedule_id"])


def downgrade() -> None:
    op.drop_table("user_schedule_orders")
    op.drop_index("ix_schedule_missions_planned_date", table_name="schedule_missions")
    op.drop_column("schedule_missions", "planned_date")
