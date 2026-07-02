"""use mission photo api urls

Revision ID: 20260702_0007
Revises: 20260702_0006
Create Date: 2026-07-02
"""
from typing import Sequence, Union

from alembic import op

revision: str = "20260702_0007"
down_revision: Union[str, None] = "20260702_0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


MISSION_CODES = [
    "MTN_B01",
    "MTN_B02",
    "MTN_R01",
    "MTN_S01",
    "SEA_B01",
    "SEA_B02",
    "SEA_R01",
    "SEA_S01",
    "CITY_B01",
    "CITY_B02",
    "CITY_R01",
    "CITY_S01",
]


def upgrade() -> None:
    for code in MISSION_CODES:
        op.execute(
            f"""
            UPDATE missions
            SET target_photo_url = '/missions/{code}/photo'
            WHERE code = '{code}'
            """
        )


def downgrade() -> None:
    for code in MISSION_CODES:
        op.execute(
            f"""
            UPDATE missions
            SET target_photo_url = '/static/mission-photos/{code}.jpg'
            WHERE code = '{code}'
            """
        )
