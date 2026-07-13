"""add mission emoji asset URLs

Revision ID: 20260713_0017
Revises: 20260713_0016
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260713_0017"
down_revision: Union[str, None] = "20260713_0016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


MISSION_CODES = (
    "MTN_B01", "MTN_B02", "MTN_R01", "MTN_S01",
    "SEA_B01", "SEA_B02", "SEA_R01", "SEA_S01",
    "CITY_B01", "CITY_B02", "CITY_R01", "CITY_S01",
)


def upgrade() -> None:
    op.add_column(
        "missions",
        sa.Column("emoji_url", sa.String(length=1000), nullable=True),
    )
    missions = sa.table(
        "missions",
        sa.column("code", sa.String(length=30)),
        sa.column("emoji_url", sa.String(length=1000)),
    )
    for code in MISSION_CODES:
        op.execute(
            missions.update()
            .where(missions.c.code == code)
            .values(emoji_url=f"/static/mission-emoji/{code}_e.png")
        )


def downgrade() -> None:
    op.drop_column("missions", "emoji_url")
