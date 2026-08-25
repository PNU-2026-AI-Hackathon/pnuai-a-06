"""seed English mission addresses

Revision ID: 20260824_0044
Revises: 20260824_0043
Create Date: 2026-08-24
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260824_0044"
down_revision: str | None = "20260824_0043"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


MISSION_ADDRESSES = {
    "CITY_B01": "7 Guposijang 2-gil, Buk-gu, Busan",
    "CITY_B02": "40 Munhyeongeumyung-ro, Nam-gu, Busan",
    "CITY_B03": "67-1 Daecheong-ro, Jung-gu, Busan",
    "CITY_B04": "39 Oncheoncheonnam-ro, Yeonje-gu, Busan",
    "CITY_R01": "43 Nakdongnam-ro 1233beon-gil, Saha-gu, Busan",
    "CITY_R02": "203 Gamnae 2-ro, Saha-gu, Busan",
    "CITY_S01": "14 Dongnaesijang-gil, Dongnae-gu, Busan",
    "CITY_S02": "44 Gudeok-ro, Jung-gu, Busan",
    "CITY_S03": "56 Seomyeon-ro, Busanjin-gu, Busan",
    "MTN_B01": "San 50-18, Jeonpo-dong, Busanjin-gu, Busan",
    "MTN_B02": "77 Choeupcheon-ro 43beon-gil, Busanjin-gu, Busan",
    "MTN_B03": "175-146 Ujangchun-ro, Dongnae-gu, Busan",
    "MTN_B04": "250 Beomeosa-ro, Geumjeong-gu, Busan",
    "MTN_B05": "78-5 Bukmun-ro, Geumjeong-gu, Busan",
    "MTN_R01": "Mandeok-dong, Buk-gu, Busan",
    "MTN_S01": "78-5 Bukmun-ro, Geumjeong-gu, Busan",
    "SEA_B01": "712-2 Songjeong-dong, Haeundae-gu, Busan",
    "SEA_B02": "Amnam-dong, Seo-gu, Busan",
    "SEA_B03": "52 Jagalchihaean-ro, Jung-gu, Busan",
    "SEA_R01": "Dadae-dong, Saha-gu, Busan",
    "SEA_R02": "86 Yonggung-gil, Gijang-eup, Gijang-gun, Busan",
    "SEA_S01": "52 Jagalchihaean-ro, Jung-gu, Busan",
    "SEA_S02": "Dadae-dong, Saha-gu, Busan",
    "DEMO_B01": "23 Geumganggongwon-ro 20beon-gil, Dongnae-gu, Busan",
    "DEMO_B02": "23 Geumganggongwon-ro 20beon-gil, Dongnae-gu, Busan",
    "DEMO_B03": "23 Geumganggongwon-ro 20beon-gil, Dongnae-gu, Busan",
    "DEMO_B04": "23 Geumganggongwon-ro 20beon-gil, Dongnae-gu, Busan",
    "DEMO_B05": "23 Geumganggongwon-ro 20beon-gil, Dongnae-gu, Busan",
    "DEMO_B06": "23 Geumganggongwon-ro 20beon-gil, Dongnae-gu, Busan",
    "DEMO_B07": "23 Geumganggongwon-ro 20beon-gil, Dongnae-gu, Busan",
    "DEMO_B08": "23 Geumganggongwon-ro 20beon-gil, Dongnae-gu, Busan",
    "DEMO_B09": "23 Geumganggongwon-ro 20beon-gil, Dongnae-gu, Busan",
    "DEMO_B10": "23 Geumganggongwon-ro 20beon-gil, Dongnae-gu, Busan",
}


def upgrade() -> None:
    connection = op.get_bind()
    insert_missing = sa.text(
        """
        INSERT INTO mission_translations (mission_id, locale, address)
        SELECT id, 'en', :address
        FROM missions
        WHERE code = :code
        ON CONFLICT (mission_id, locale) DO NOTHING
        """
    )
    fill_blank = sa.text(
        """
        UPDATE mission_translations AS translation
        SET address = :address,
            updated_at = now()
        FROM missions AS mission
        WHERE translation.mission_id = mission.id
          AND translation.locale = 'en'
          AND mission.code = :code
          AND NULLIF(BTRIM(translation.address), '') IS NULL
        """
    )

    for code, address in MISSION_ADDRESSES.items():
        parameters = {"code": code, "address": address}
        connection.execute(insert_missing, parameters)
        connection.execute(fill_blank, parameters)


def downgrade() -> None:
    connection = op.get_bind()
    clear_seeded = sa.text(
        """
        UPDATE mission_translations AS translation
        SET address = NULL,
            updated_at = now()
        FROM missions AS mission
        WHERE translation.mission_id = mission.id
          AND translation.locale = 'en'
          AND mission.code = :code
          AND translation.address = :address
        """
    )

    for code, address in MISSION_ADDRESSES.items():
        connection.execute(clear_seeded, {"code": code, "address": address})
