"""add structured judgement rules to missions

Revision ID: 20260802_0028
Revises: 20260716_0027
"""
import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260802_0028"
down_revision: Union[str, None] = "20260716_0027"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


RULES = {
    "MTN_B01": {
        "required_elements": ["산 전망대", "부산 도심 또는 바다 조망"],
        "optional_elements": ["봉수대 또는 전망대 난간"],
        "forbidden_elements": ["실내 중심 사진", "도시 조망이 전혀 없음"],
        "min_people": 0,
        "max_people": None,
        "ocr_required": False,
        "weights": {"required": 0.65, "reference": 0.2, "composition": 0.15},
    },
    "MTN_B02": {
        "required_elements": ["사찰 또는 전통 사찰 건축", "연등/등불 또는 이마를 비추는 빛"],
        "optional_elements": ["삼광사로 보이는 사찰 특징"],
        "forbidden_elements": ["사찰·등불 요소가 전혀 없음"],
        "min_people": 0,
        "max_people": None,
        "ocr_required": False,
        "weights": {"required": 0.65, "reference": 0.2, "composition": 0.15},
    },
    "MTN_R01": {
        "required_elements": ["나무와 숲이 화면 대부분을 차지함", "자연 산책로 또는 숲속 풍경"],
        "optional_elements": ["초록색 식생", "숲의 깊이감"],
        "forbidden_elements": ["건물", "차량 도로", "도시 풍경이 화면의 주요 부분을 차지함"],
        "min_people": 0,
        "max_people": None,
        "ocr_required": False,
        "weights": {"required": 0.7, "forbidden": 0.2, "reference": 0.1},
    },
    "MTN_S01": {
        "required_elements": ["이마에 흰색 수건 또는 손수건", "금색 막걸리 잔", "야외 노포 또는 야장 분위기"],
        "optional_elements": ["금정산성 주변 분위기"],
        "forbidden_elements": ["흰 수건이 없음", "잔이 금색으로 보이지 않음", "실내 일반 식당"],
        "min_people": 1,
        "max_people": None,
        "ocr_required": False,
        "weights": {"required": 0.7, "reference": 0.15, "composition": 0.15},
    },
    "SEA_B01": {
        "required_elements": ["바다", "서핑 중인 사람", "서핑보드"],
        "optional_elements": ["파도", "송정 해변 분위기"],
        "forbidden_elements": ["서핑보드가 없음", "서핑 중인 사람이 없음"],
        "min_people": 1,
        "max_people": None,
        "ocr_required": False,
        "weights": {"required": 0.7, "reference": 0.2, "composition": 0.1},
    },
    "SEA_B02": {
        "required_elements": ["사람 정확히 2명", "바다 또는 해변", "두 사람이 손을 잡고 있음"],
        "optional_elements": ["두 사람이 함께 포즈를 취함"],
        "forbidden_elements": ["사람 1명", "사람 3명 이상", "손을 잡고 있지 않음"],
        "min_people": 2,
        "max_people": 2,
        "ocr_required": False,
        "weights": {"required": 0.75, "reference": 0.15, "composition": 0.1},
    },
    "SEA_R01": {
        "required_elements": ["바닷물에 들어간 상태", "젖은 옷 또는 젖은 신체"],
        "optional_elements": ["다대포 해수욕장 분위기", "물놀이 흔적"],
        "forbidden_elements": ["물에 들어간 증거가 없음", "옷과 신체가 모두 마른 상태로만 보임"],
        "min_people": 1,
        "max_people": None,
        "ocr_required": False,
        "weights": {"required": 0.7, "reference": 0.2, "composition": 0.1},
    },
    "SEA_S01": {
        "required_elements": ["해산물", "와사비 요소", "친구의 일그러지거나 놀란 표정"],
        "optional_elements": ["자갈치시장 또는 수산시장 분위기"],
        "forbidden_elements": ["해산물이 없음", "사람 표정이 보이지 않음"],
        "min_people": 2,
        "max_people": None,
        "ocr_required": False,
        "weights": {"required": 0.75, "reference": 0.15, "composition": 0.1},
    },
    "CITY_B01": {
        "required_elements": ["시장 또는 상점가", "파라솔", "파라솔과 유사한 색상의 옷"],
        "optional_elements": ["구포시장 분위기"],
        "forbidden_elements": ["파라솔이 없음", "옷과 파라솔의 색상 차이가 큼"],
        "min_people": 1,
        "max_people": None,
        "ocr_required": False,
        "weights": {"required": 0.7, "reference": 0.15, "composition": 0.15},
    },
    "CITY_B02": {
        "required_elements": ["고층 건물", "야간", "인공 조명 또는 네온빛"],
        "optional_elements": ["부산항대교 또는 문현금융단지 야경 분위기"],
        "forbidden_elements": ["낮 사진", "고층 건물이나 조명이 거의 없음"],
        "min_people": 0,
        "max_people": None,
        "ocr_required": False,
        "weights": {"required": 0.7, "reference": 0.2, "composition": 0.1},
    },
    "CITY_R01": {
        "required_elements": ["탁 트인 공원 또는 잔디", "돗자리", "야외에서 쉬는 모습"],
        "optional_elements": ["을숙도 자연공원 분위기", "나무 또는 넓은 녹지"],
        "forbidden_elements": ["돗자리가 없음", "실내", "건물이 화면 대부분을 차지함"],
        "min_people": 1,
        "max_people": None,
        "ocr_required": False,
        "weights": {"required": 0.7, "reference": 0.15, "composition": 0.15},
    },
    "CITY_S01": {
        "required_elements": ["물떡", "사람 2명이 마주 보고 있음", "물떡이 거의 남지 않은 상태"],
        "optional_elements": ["동래시장 분식·시장 분위기"],
        "forbidden_elements": ["물떡이 없음", "두 사람이 아닌 경우", "물떡이 많이 남아 있음"],
        "min_people": 2,
        "max_people": 2,
        "ocr_required": False,
        "measurement_tolerance_cm": 2,
        "weights": {"required": 0.75, "reference": 0.15, "composition": 0.1},
    },
}


def upgrade() -> None:
    op.add_column("missions", sa.Column("judgement_rules", sa.JSON(), nullable=True))
    connection = op.get_bind()
    for code, rules in RULES.items():
        connection.execute(
            sa.text("UPDATE missions SET judgement_rules = :rules WHERE code = :code"),
            {"rules": json.dumps(rules, ensure_ascii=False), "code": code},
        )


def downgrade() -> None:
    op.drop_column("missions", "judgement_rules")
