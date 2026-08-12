"""add judgement rules for the latest registered missions

Revision ID: 20260811_0032
Revises: 20260811_0031
"""
import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260811_0032"
down_revision: Union[str, None] = "20260811_0031"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


RULES = {
    "SEA_R02": {
        "required_elements": [
            "바다와 직접 맞닿아 있는 크고 가파른 암석 절벽",
            "파도가 절벽 또는 바위에 부딪히며 생기는 흰 물보라",
            "절벽과 바다가 한 화면에 함께 보임",
        ],
        "optional_elements": [
            "거칠고 층이 드러난 해식 암벽",
            "높고 웅장한 절벽 구도",
            "해동용궁사 주변 해안 분위기",
        ],
        "forbidden_elements": [
            "바다가 없는 일반 산악 절벽",
            "절벽 없이 모래사장이나 잔잔한 바다만 보임",
            "파도가 절벽에 부딪히는 장면이나 물보라가 보이지 않음",
        ],
        "min_people": 0,
        "max_people": None,
        "ocr_required": False,
        "weights": {"required": 0.8, "forbidden": 0.1, "reference": 0.1},
    },
    "CITY_B04": {
        "required_elements": [
            "꽃이 핀 벚나무 또는 벚꽃 가지",
            "하천·개울·강 등 길게 이어진 수면",
            "수면에 비친 벚꽃 또는 조명의 반영",
        ],
        "optional_elements": [
            "하천 양쪽의 벚꽃길",
            "수변 산책로",
            "해 질 무렵 또는 야간 경관조명",
            "온천천 도심 하천 분위기",
        ],
        "forbidden_elements": [
            "벚꽃만 보이고 하천이나 수면이 없음",
            "수면은 있으나 벚꽃이나 조명의 반영이 식별되지 않음",
            "벚꽃이 아닌 다른 꽃만 촬영함",
        ],
        "min_people": 0,
        "max_people": None,
        "ocr_required": False,
        "weights": {"required": 0.75, "forbidden": 0.15, "reference": 0.1},
    },
}


def upgrade() -> None:
    connection = op.get_bind()
    for code, rules in RULES.items():
        connection.execute(
            sa.text(
                """
                UPDATE missions
                SET judgement_rules = :rules,
                    updated_at = now()
                WHERE code = :code
                  AND judgement_rules IS NULL
                """
            ),
            {"rules": json.dumps(rules, ensure_ascii=False), "code": code},
        )


def downgrade() -> None:
    connection = op.get_bind()
    connection.execute(
        sa.text(
            """
            UPDATE missions
            SET judgement_rules = NULL,
                updated_at = now()
            WHERE code IN :codes
            """
        ).bindparams(sa.bindparam("codes", expanding=True)),
        {"codes": list(RULES)},
    )
