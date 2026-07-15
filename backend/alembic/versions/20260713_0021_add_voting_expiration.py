"""add voting expiration time

Revision ID: 20260713_0021
Revises: 20260713_0020
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260713_0021"
down_revision: Union[str, None] = "20260713_0020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "mission_sessions",
        sa.Column("voting_expires_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("mission_sessions", "voting_expires_at")
