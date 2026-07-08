"""update mission places

Revision ID: 20260708_0014
Revises: 20260708_0013
Create Date: 2026-07-08
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260708_0014"
down_revision: Union[str, None] = "20260708_0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


MISSION_UPDATES = [
    ("MTN_B01", "NAM", "남구", "황령산 봉수대"),
    ("MTN_B02", "BUSANJIN", "부산진구", "삼광사"),
    ("MTN_R01", "DONGNAE", "동래구", "금강공원"),
    ("MTN_S01", "GEUMJEONG", "금정구", "금정산성"),
    ("SEA_B01", "HAEUNDAE", "해운대구", "송정"),
    ("SEA_B02", "GIJANG", "기장군", "일광"),
    ("SEA_R01", "HAEUNDAE", "해운대구", "해운대 해수욕장"),
    ("SEA_S01", "SAHA", "사하구", "다대포"),
    ("CITY_B01", "JUNG", "중구", "국제시장"),
    ("CITY_B02", "YEONJE", "연제구", "부산시청"),
    ("CITY_R01", "GANGSEO", "강서구", "을숙도"),
    ("CITY_S01", "JUNG", "중구", "부산역"),
]


def upgrade() -> None:
    op.add_column("missions", sa.Column("place_label", sa.String(length=150), nullable=True))
    bind = op.get_bind()
    for code, district_code, district_label, place_label in MISSION_UPDATES:
        bind.execute(
            sa.text(
                "UPDATE missions "
                "SET district_code = :district_code, "
                "district_label = :district_label, "
                "place_label = :place_label "
                "WHERE code = :code"
            ),
            {
                "code": code,
                "district_code": district_code,
                "district_label": district_label,
                "place_label": place_label,
            },
        )


def downgrade() -> None:
    op.drop_column("missions", "place_label")
