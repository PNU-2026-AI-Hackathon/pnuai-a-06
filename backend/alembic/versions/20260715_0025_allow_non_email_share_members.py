"""allow share-link members without email addresses

Revision ID: 20260715_0025
Revises: 20260713_0024
"""
from typing import Sequence, Union

from alembic import op


revision: str = "20260715_0025"
down_revision: Union[str, None] = "20260713_0024"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "schedule_members",
        "invite_email",
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "schedule_members",
        "invite_email",
        nullable=False,
    )
