"""move profile image URLs to static storage

Revision ID: 20260713_0024
Revises: 20260713_0023
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260713_0024"
down_revision: Union[str, None] = "20260713_0023"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        sa.text(
            "UPDATE users "
            "SET profile_image_url = '/static/profile-images/' || "
            "substring(profile_image_url from '/auth/profile-images/(.*)$') "
            "WHERE profile_image_url LIKE '/auth/profile-images/%'"
        )
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            "UPDATE users "
            "SET profile_image_url = '/auth/profile-images/' || "
            "substring(profile_image_url from '/static/profile-images/(.*)$') "
            "WHERE profile_image_url LIKE '/static/profile-images/%'"
        )
    )
