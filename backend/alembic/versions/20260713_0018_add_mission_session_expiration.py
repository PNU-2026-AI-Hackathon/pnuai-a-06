"""add mission session expiration time

Revision ID: 20260713_0018
Revises: 20260713_0017
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260713_0018"
down_revision: Union[str, None] = "20260713_0017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "mission_sessions",
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute(
        sa.text(
            "UPDATE mission_sessions "
            "SET expires_at = started_at + interval '30 minutes' "
            "WHERE started_at IS NOT NULL"
        )
    )


def downgrade() -> None:
    op.drop_column("mission_sessions", "expires_at")
