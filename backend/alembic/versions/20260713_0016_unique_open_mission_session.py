"""ensure one open mission session per schedule mission

Revision ID: 20260713_0016
Revises: 20260712_0015
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260713_0016"
down_revision: Union[str, None] = "20260712_0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "uq_mission_sessions_open_schedule_mission",
        "mission_sessions",
        ["schedule_mission_id"],
        unique=True,
        postgresql_where=sa.text("status <> 'COMPLETED'"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_mission_sessions_open_schedule_mission",
        table_name="mission_sessions",
    )
