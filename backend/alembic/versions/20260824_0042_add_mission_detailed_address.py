"""add mission detailed address

Revision ID: 20260824_0042
Revises: 20260820_0041
Create Date: 2026-08-24
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260824_0042"
down_revision: str | None = "20260820_0041"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("missions", sa.Column("address", sa.String(length=300), nullable=True))
    op.add_column(
        "mission_translations",
        sa.Column("address", sa.String(length=300), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("mission_translations", "address")
    op.drop_column("missions", "address")
