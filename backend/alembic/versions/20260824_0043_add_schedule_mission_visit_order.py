"""add schedule mission visit order

Revision ID: 20260824_0043
Revises: 20260824_0042
Create Date: 2026-08-24
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260824_0043"
down_revision: str | None = "20260824_0042"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "schedule_missions",
        sa.Column("visit_order", sa.Integer(), server_default="1", nullable=False),
    )
    op.execute(
        """
        WITH ranked AS (
            SELECT
                id,
                ROW_NUMBER() OVER (
                    PARTITION BY schedule_id, planned_date
                    ORDER BY created_at, id
                ) AS position
            FROM schedule_missions
        )
        UPDATE schedule_missions AS sm
        SET visit_order = ranked.position
        FROM ranked
        WHERE sm.id = ranked.id
        """
    )
    op.create_index(
        "ix_schedule_missions_schedule_date_visit_order",
        "schedule_missions",
        ["schedule_id", "planned_date", "visit_order"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_schedule_missions_schedule_date_visit_order",
        table_name="schedule_missions",
    )
    op.drop_column("schedule_missions", "visit_order")
