"""update mission titles and locations

Revision ID: 20260810_0029
Revises: 20260802_0028
"""
import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260810_0029"
down_revision: Union[str, None] = "20260802_0028"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


UPDATES = {
    "MTN_R01": {
        "title": "피톤치드 힐링",
        "district_code": "BUK",
        "district_label": "북구",
        "place_label": "백양산",
        "optional_elements": ["초록색 식생", "숲의 깊이감", "백양산 숲 분위기"],
    },
    "SEA_B02": {
        "title": "둘이서 떠나요",
        "district_code": "SEO",
        "district_label": "서구",
        "place_label": "송도",
        "optional_elements": ["두 사람이 함께 포즈를 취함", "송도 해변 분위기"],
    },
    "SEA_R01": {
        "title": "바다에 왔으면 옷이 젖어야 하는 법",
        "district_code": "SAHA",
        "district_label": "사하구",
        "place_label": "다대포 해수욕장",
        "optional_elements": ["다대포 해수욕장 분위기", "물놀이 흔적"],
    },
    "SEA_S01": {
        "title": "친구야 선물이야",
        "district_code": "JUNG",
        "district_label": "중구",
        "place_label": "자갈치시장",
        "optional_elements": ["자갈치시장 또는 수산시장 분위기"],
    },
    "CITY_B01": {
        "title": "카멜레온 게임",
        "district_code": "BUK",
        "district_label": "북구",
        "place_label": "구포시장",
        "optional_elements": ["구포시장 분위기"],
    },
    "CITY_B02": {
        "title": "사이버펑크 부산",
        "district_code": "NAM",
        "district_label": "남구",
        "place_label": "부산항대교, 문현금융단지",
        "optional_elements": ["부산항대교 또는 문현금융단지 야경 분위기"],
    },
    "CITY_S01": {
        "title": "물떡 빼빼로 게임",
        "district_code": "DONGNAE",
        "district_label": "동래구",
        "place_label": "동래시장",
        "optional_elements": ["동래시장 분식·시장 분위기"],
    },
}


OLD_VALUES = {
    "MTN_R01": ("피톤치드 힐링", "DONGNAE", "동래구", "금강공원", ["초록색 식생", "숲의 깊이감"]),
    "SEA_B02": ("둘이서 떠나요", "GIJANG", "기장군", "일광", ["두 사람이 함께 포즈를 취함"]),
    "SEA_R01": ("바다에 왔으면 옷이 젖어야 하는 법", "HAEUNDAE", "해운대구", "해운대 해수욕장", ["해운대 해변 분위기", "물놀이 흔적"]),
    "SEA_S01": ("와사비 폭탄", "SAHA", "사하구", "다대포", ["다대포 해변 또는 야외 식사 분위기"]),
    "CITY_B01": ("카멜레온 게임", "JUNG", "중구", "국제시장", ["국제시장 분위기"]),
    "CITY_B02": ("사이버펑크 부산", "YEONJE", "연제구", "부산시청", ["부산시청 주변 도시 야경 분위기"]),
    "CITY_S01": ("물떡 빼빼로 게임", "JUNG", "중구", "부산역", ["부산역 분식·시장 분위기"]),
}


def _update_mission(connection, code, title, district_code, district_label, place_label, optional_elements):
    connection.execute(
        sa.text(
            """
            UPDATE missions
            SET title = :title,
                district_code = :district_code,
                district_label = :district_label,
                place_label = :place_label,
                judgement_rules = jsonb_set(
                    judgement_rules::jsonb,
                    '{optional_elements}',
                    CAST(:optional_elements AS jsonb),
                    true
                )::json
            WHERE code = :code
            """
        ),
        {
            "code": code,
            "title": title,
            "district_code": district_code,
            "district_label": district_label,
            "place_label": place_label,
            "optional_elements": json.dumps(optional_elements, ensure_ascii=False),
        },
    )


def upgrade() -> None:
    connection = op.get_bind()
    for code, values in UPDATES.items():
        _update_mission(connection, code, **values)


def downgrade() -> None:
    connection = op.get_bind()
    for code, values in OLD_VALUES.items():
        _update_mission(connection, code, *values)
