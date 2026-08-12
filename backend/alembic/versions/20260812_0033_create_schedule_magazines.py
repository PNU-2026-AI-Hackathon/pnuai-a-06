"""create generated schedule magazines

Revision ID: 20260812_0033
Revises: 20260811_0032
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260812_0033"
down_revision: Union[str, None] = "20260811_0032"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "schedule_magazines",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("schedule_id", sa.Integer(), nullable=False),
        sa.Column("template_key", sa.String(length=100), nullable=False),
        sa.Column("template_version", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("source_fingerprint", sa.String(length=64), nullable=True),
        sa.Column("image_urls", sa.JSON(), nullable=False),
        sa.Column("source_snapshot", sa.JSON(), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["schedule_id"], ["mission_schedules.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("schedule_id", "template_key", name="uq_schedule_magazines_schedule_template"),
    )
    op.create_index("ix_schedule_magazines_id", "schedule_magazines", ["id"])
    op.create_index("ix_schedule_magazines_schedule_id", "schedule_magazines", ["schedule_id"])


def downgrade() -> None:
    op.drop_index("ix_schedule_magazines_schedule_id", table_name="schedule_magazines")
    op.drop_index("ix_schedule_magazines_id", table_name="schedule_magazines")
    op.drop_table("schedule_magazines")
