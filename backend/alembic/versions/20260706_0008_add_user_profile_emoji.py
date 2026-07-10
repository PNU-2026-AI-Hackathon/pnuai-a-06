"""add user profile emoji

Revision ID: 20260706_0008
Revises: 20260702_0007
Create Date: 2026-07-06
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260706_0008"
down_revision: Union[str, None] = "20260702_0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("profile_emoji", sa.String(length=32), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "profile_emoji")
