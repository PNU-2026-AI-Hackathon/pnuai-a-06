"""update mission districts per mission

Revision ID: 20260702_0006
Revises: 20260702_0005
Create Date: 2026-07-02
"""
from typing import Sequence, Union

from alembic import op

revision: str = "20260702_0006"
down_revision: Union[str, None] = "20260702_0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


MISSION_DISTRICTS = {
    "MTN_B01": ("NAM", "남구"),
    "MTN_B02": ("GEUMJEONG", "금정구"),
    "MTN_R01": ("GIJANG", "기장군"),
    "MTN_S01": ("GEUMJEONG", "금정구"),
    "SEA_B01": ("HAEUNDAE", "해운대구"),
    "SEA_B02": ("SUYEONG", "수영구"),
    "SEA_R01": ("HAEUNDAE", "해운대구"),
    "SEA_S01": ("JUNG", "중구"),
    "CITY_B01": ("JUNG", "중구"),
    "CITY_B02": ("HAEUNDAE", "해운대구"),
    "CITY_R01": ("BUSANJIN", "부산진구"),
    "CITY_S01": ("JUNG", "중구"),
}


def upgrade() -> None:
    for code, (district_code, district_label) in MISSION_DISTRICTS.items():
        op.execute(
            f"""
            UPDATE missions
            SET district_code = '{district_code}',
                district_label = '{district_label}'
            WHERE code = '{code}'
            """
        )


def downgrade() -> None:
    op.execute(
        """
        UPDATE missions
        SET district_code = CASE
            WHEN type = 'SIDE' THEN 'ALL_BUSAN'
            WHEN theme = 'MOUNTAIN' THEN 'SAHA_SEO'
            WHEN theme = 'SEA' THEN 'YEONGDO'
            WHEN theme = 'CITY' THEN 'JUNG'
        END,
        district_label = CASE
            WHEN type = 'SIDE' THEN '부산 전역'
            WHEN theme = 'MOUNTAIN' THEN '사하구·서구'
            WHEN theme = 'SEA' THEN '영도구'
            WHEN theme = 'CITY' THEN '중구'
        END
        """
    )
