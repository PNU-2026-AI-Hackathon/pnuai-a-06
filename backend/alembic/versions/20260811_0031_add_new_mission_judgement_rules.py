"""add judgement rules for newly registered missions

Revision ID: 20260811_0031
Revises: 20260810_0030
"""
import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260811_0031"
down_revision: Union[str, None] = "20260810_0030"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


RULES = {
    "MTN_B03": {
        "required_elements": [
            "케이블카 객실의 창문·프레임 또는 투명 바닥",
            "사진 하단에 촬영자의 발 또는 신발",
            "창문이나 투명 바닥 너머로 보이는 산·숲·계곡 풍경",
        ],
        "optional_elements": ["케이블 선로", "다른 케이블카", "높은 곳에서 내려다보는 구도"],
        "forbidden_elements": [
            "발이나 신발이 보이지 않음",
            "케이블카 내부라는 시각적 증거가 없음",
            "산·숲·계곡 없이 일반 실내만 보임",
        ],
        "min_people": 0,
        "max_people": None,
        "ocr_required": False,
        "weights": {"required": 0.7, "forbidden": 0.15, "reference": 0.15},
    },
    "MTN_B04": {
        "required_elements": [
            "다람쥐·새·고양이 등 실제 동물이 한 마리 이상 명확하게 식별됨",
            "산길·숲·나무·바위 또는 사찰 주변의 야외 자연환경",
        ],
        "optional_elements": ["범어사 주변 산책로", "두 종류 이상의 동물"],
        "forbidden_elements": [
            "동물 그림·사진·조형물·인형만 촬영함",
            "동물이 너무 작거나 흐려 종류를 식별할 수 없음",
            "실내 반려동물 사진",
        ],
        "min_people": 0,
        "max_people": None,
        "ocr_required": False,
        "weights": {"required": 0.75, "forbidden": 0.15, "reference": 0.1},
    },
    "MTN_B05": {
        "required_elements": [
            "산 능선·봉우리 또는 산길",
            "안개·구름·운해가 산 중턱이나 능선 아래를 넓게 덮고 있음",
        ],
        "optional_elements": ["능선을 걷는 사람", "여러 겹으로 이어진 산 능선", "일출 또는 일몰빛"],
        "forbidden_elements": [
            "안개나 구름 없이 맑은 산 풍경만 보임",
            "도시의 미세먼지·연기만 보임",
            "산이 보이지 않는 하늘 또는 실내 사진",
        ],
        "min_people": 0,
        "max_people": None,
        "ocr_required": False,
        "weights": {"required": 0.75, "forbidden": 0.15, "reference": 0.1},
    },
    "SEA_S02": {
        "required_elements": [
            "펼친 손바닥",
            "손바닥 위에 조개껍데기 또는 자연석이 합계 3개 이상",
            "모래사장·파도·바다 중 하나 이상이 보이는 해변 배경",
        ],
        "optional_elements": ["조개껍데기와 자연석이 함께 있음", "다대포 해수욕장 분위기"],
        "forbidden_elements": [
            "조개껍데기와 돌의 합계가 3개 미만",
            "수집물이 손바닥 위에 놓여 있지 않음",
            "플라스틱 장난감·장신구 등 인공물만 있음",
        ],
        "min_people": 0,
        "max_people": None,
        "ocr_required": False,
        "weights": {"required": 0.8, "forbidden": 0.1, "reference": 0.1},
    },
    "SEA_B03": {
        "required_elements": [
            "날개를 펼치고 날고 있는 갈매기가 3마리 이상",
            "바다·항구·해안 산책로 중 하나 이상이 보이는 배경",
        ],
        "optional_elements": ["사람과 갈매기가 함께 보이는 역동적인 구도", "자갈치 항구 또는 부산 해안 분위기"],
        "forbidden_elements": [
            "갈매기가 한두 마리만 보임",
            "갈매기가 모두 바닥이나 난간에 앉아 있음",
            "바다와 무관한 내륙 조류 사진",
        ],
        "min_people": 0,
        "max_people": None,
        "ocr_required": False,
        "weights": {"required": 0.75, "forbidden": 0.15, "reference": 0.1},
    },
    "CITY_B03": {
        "required_elements": [
            "표지가 보이는 실제 책 한 권 이상",
            "책장·헌책 더미·서점 진열대 등 헌책방 환경",
        ],
        "optional_elements": ["사람이 고른 책을 손에 들고 있음", "오래된 책이 빽빽하게 진열된 골목 책방 분위기"],
        "forbidden_elements": [
            "전자책 화면이나 휴대전화 속 책만 보임",
            "책 표지가 전혀 식별되지 않음",
            "책방과 무관한 일반 실내 사진",
        ],
        "min_people": 0,
        "max_people": None,
        "ocr_required": False,
        "weights": {"required": 0.7, "forbidden": 0.15, "reference": 0.15},
    },
    "CITY_R02": {
        "required_elements": [
            "사람이 한 명 이상 보임",
            "벽면의 그림 또는 벽화가 명확하게 보임",
            "사람의 자세나 신체 일부가 벽화의 선·날개·팔다리·사물과 시각적으로 이어짐",
        ],
        "optional_elements": ["날개 벽화와 사람의 어깨가 맞춰진 구도", "감천문화마을의 색채가 보이는 골목"],
        "forbidden_elements": [
            "벽화 없이 사람만 촬영함",
            "사람이 벽화 앞에 서 있지만 그림과 이어지는 구도가 아님",
            "벽화와 사람이 너무 멀거나 흐려 합체 여부를 판단할 수 없음",
        ],
        "min_people": 1,
        "max_people": None,
        "ocr_required": False,
        "weights": {"required": 0.8, "forbidden": 0.1, "reference": 0.1},
    },
    "CITY_S02": {
        "required_elements": [
            "씨앗호떡 한 개 이상",
            "호떡이 갈라지거나 베어 물려 내부 단면이 노출됨",
            "단면 안의 씨앗·견과류 속재료가 명확하게 식별됨",
        ],
        "optional_elements": ["호떡 단면을 크게 보여주는 근접 촬영", "BIFF 광장 포장마차 분위기", "호떡을 먹는 사람"],
        "forbidden_elements": [
            "씨앗이나 견과류가 보이지 않는 일반 호떡",
            "호떡 내부 단면이 보이지 않음",
            "호떡과 무관한 음식 사진",
        ],
        "min_people": 0,
        "max_people": None,
        "ocr_required": False,
        "weights": {"required": 0.8, "forbidden": 0.1, "reference": 0.1},
    },
    "CITY_S03": {
        "required_elements": [
            "돼지국밥으로 보이는 국물과 고기가 담긴 뚝배기",
            "뚝배기 위로 올라오는 김 또는 수증기",
            "국밥과 함께 촬영된 사람의 얼굴",
        ],
        "optional_elements": ["뚝배기를 얼굴 가까이 들고 있는 모습", "서면 돼지국밥 식당 분위기", "김치·밥 등 국밥 상차림"],
        "forbidden_elements": [
            "사람 얼굴이 보이지 않음",
            "김이나 수증기가 전혀 보이지 않음",
            "돼지국밥이 아닌 다른 음식만 촬영함",
        ],
        "min_people": 1,
        "max_people": None,
        "ocr_required": False,
        "weights": {"required": 0.8, "forbidden": 0.1, "reference": 0.1},
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
