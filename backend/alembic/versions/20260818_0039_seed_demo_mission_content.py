"""seed demo missions, judgement rules, and English content

Revision ID: 20260818_0039
Revises: 20260818_0038
"""
import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260818_0039"
down_revision: Union[str, None] = "20260818_0038"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# code: Korean title, Korean description
DEMO_MISSIONS = {
    "DEMO_B01": (
        "부산 바다 만들기",
        "파란색 물체(펜·텀블러·옷 등)를 화면 가득 들어 광안리 바다를 표현",
    ),
    "DEMO_B02": (
        "갈매기 손",
        "두 팔을 활짝 벌려 갈매기가 나는 포즈",
    ),
    "DEMO_B03": (
        "부산 갈매기 떼창",
        "프레임 안 모든 인원이 입을 크게 벌리고 노래하는 표정",
    ),
    "DEMO_B04": (
        "파도타기",
        "두세 명이 팔을 이어 파도(웨이브) 동작을 만든 순간 포착",
    ),
    "DEMO_B05": (
        "회 뜨는 손",
        "한 손으로 칼질(가라데 촙) 흉내 포즈",
    ),
    "DEMO_B06": (
        "밀면 후루룩",
        "젓가락(또는 펜 두 개)으로 면치기 하는 표정 연출",
    ),
    "DEMO_B07": (
        "광안대교 아치",
        "두 사람이 손을 맞잡아 머리 위로 아치(다리 모양) 만들기",
    ),
    "DEMO_B08": (
        "동백꽃 하트",
        "빨간색 물체를 손 하트 안에 담아 부산시 상징 동백 표현",
    ),
    "DEMO_B09": (
        "마! 친구 아이가",
        "놀란 듯 손바닥을 앞으로 내미는 포즈",
    ),
    "DEMO_B10": (
        "자갈치 아지매 파이팅",
        "두 주먹을 불끈 쥐고 힘내는 포즈",
    ),
}


RULES = {
    "DEMO_B01": {
        "required_elements": [
            "파란색 물체가 한 개 이상 명확하게 보임",
            "참가자가 파란색 물체를 직접 들고 있거나 몸 앞에 펼쳐 보임",
            "파란색 물체가 화면에서 눈에 띄는 넓은 면적을 차지해 바다를 표현함",
        ],
        "optional_elements": [
            "서로 다른 종류의 파란색 물체가 여러 개 보임",
            "파도나 바다를 연상시키는 배치 또는 동작",
        ],
        "forbidden_elements": [
            "파란색 물체가 전혀 보이지 않음",
            "파란색이 화면의 아주 작은 장식이나 배경에만 있음",
            "참가자가 물체를 들거나 펼쳐 보이는 수행 장면이 없음",
        ],
        "min_people": 1,
        "max_people": None,
        "ocr_required": False,
        "weights": {"required": 0.85, "forbidden": 0.1, "reference": 0.05},
    },
    "DEMO_B02": {
        "required_elements": [
            "참가자 한 명 이상이 명확하게 보임",
            "한 참가자가 양팔을 몸 양옆으로 활짝 펼침",
            "펼친 양팔이 갈매기의 날개처럼 보이는 비행 포즈",
        ],
        "optional_elements": ["양팔이 어깨 높이에 가깝게 펼쳐짐", "즐겁거나 역동적인 표정"],
        "forbidden_elements": [
            "한쪽 팔만 펼치거나 두 팔이 몸에 붙어 있음",
            "상체나 팔이 잘려 양팔 포즈를 확인할 수 없음",
            "사람 없이 갈매기나 풍경만 촬영함",
        ],
        "min_people": 1,
        "max_people": None,
        "ocr_required": False,
        "weights": {"required": 0.85, "forbidden": 0.1, "reference": 0.05},
    },
    "DEMO_B03": {
        "required_elements": [
            "참가자가 두 명 이상 함께 보임",
            "프레임에서 얼굴이 확인되는 참가자들이 입을 크게 벌림",
            "여럿이 함께 노래하거나 떼창하는 듯한 표정과 분위기",
        ],
        "optional_elements": ["손을 들거나 마이크를 든 듯한 동작", "신나게 응원하는 단체 포즈"],
        "forbidden_elements": [
            "참가자가 한 명뿐임",
            "대부분의 참가자가 입을 다물고 일반 단체 사진처럼 서 있음",
            "얼굴이 너무 작거나 가려져 노래하는 표정을 확인할 수 없음",
        ],
        "min_people": 2,
        "max_people": None,
        "ocr_required": False,
        "weights": {"required": 0.85, "forbidden": 0.1, "reference": 0.05},
    },
    "DEMO_B04": {
        "required_elements": [
            "참가자가 두 명 이상 함께 보임",
            "서로의 팔·손·어깨를 이어 연결된 자세를 만듦",
            "연결된 팔이나 몸의 높낮이가 이어져 파도 또는 웨이브처럼 보임",
        ],
        "optional_elements": ["두세 명이 한 줄로 선 구도", "몸을 기울여 파도의 흐름을 강조함"],
        "forbidden_elements": [
            "참가자들이 서로 연결되지 않음",
            "한 명만 촬영되어 파도타기 동작을 확인할 수 없음",
            "팔이나 상체가 잘려 연결된 웨이브 자세를 판단할 수 없음",
        ],
        "min_people": 2,
        "max_people": None,
        "ocr_required": False,
        "weights": {"required": 0.85, "forbidden": 0.1, "reference": 0.05},
    },
    "DEMO_B05": {
        "required_elements": [
            "참가자 한 명 이상이 명확하게 보임",
            "한 손의 손가락을 모아 편 채 손날을 세움",
            "편 손으로 무언가를 써는 듯한 가라데 촙 동작을 연출함",
        ],
        "optional_elements": ["다른 손으로 도마나 재료를 잡는 듯한 연기", "진지하게 집중하는 표정"],
        "forbidden_elements": [
            "손이 가려지거나 잘려 손날 동작을 확인할 수 없음",
            "주먹이나 손가락 포즈만 있고 써는 동작이 아님",
            "사람 없이 칼이나 음식만 촬영함",
        ],
        "min_people": 1,
        "max_people": None,
        "ocr_required": False,
        "weights": {"required": 0.85, "forbidden": 0.1, "reference": 0.05},
    },
    "DEMO_B06": {
        "required_elements": [
            "참가자 한 명 이상과 얼굴이 명확하게 보임",
            "젓가락 또는 펜처럼 가늘고 긴 물체 두 개를 한 손에 들고 있음",
            "두 물체를 입 가까이에 대고 면을 후루룩 먹는 듯한 표정을 연출함",
        ],
        "optional_elements": ["입을 벌리거나 입술을 오므린 면치기 표정", "그릇을 든 듯한 동작"],
        "forbidden_elements": [
            "젓가락이나 대체할 물체 두 개가 보이지 않음",
            "물체가 입과 멀리 떨어져 면치기 동작으로 보이지 않음",
            "얼굴이나 입이 가려져 표정을 확인할 수 없음",
        ],
        "min_people": 1,
        "max_people": None,
        "ocr_required": False,
        "weights": {"required": 0.85, "forbidden": 0.1, "reference": 0.05},
    },
    "DEMO_B07": {
        "required_elements": [
            "주요 참가자 두 명이 함께 보임",
            "두 사람이 서로의 손을 맞잡음",
            "맞잡은 손과 팔을 머리 위로 올려 다리처럼 이어진 아치를 만듦",
        ],
        "optional_elements": ["아래쪽 손도 맞잡아 큰 다리 윤곽을 만듦", "두 사람이 서로 마주 보는 구도"],
        "forbidden_elements": [
            "한 사람만 촬영됨",
            "두 사람의 손이 서로 맞닿지 않음",
            "맞잡은 손이 머리 위에 있지 않아 아치 형태가 보이지 않음",
        ],
        "min_people": 2,
        "max_people": None,
        "ocr_required": False,
        "weights": {"required": 0.85, "forbidden": 0.1, "reference": 0.05},
    },
    "DEMO_B08": {
        "required_elements": [
            "손가락으로 만든 하트 모양이 명확하게 보임",
            "하트 안쪽에 빨간색 물체가 들어 있음",
            "빨간색 물체와 손 하트가 함께 화면의 중심 소재로 보임",
        ],
        "optional_elements": ["빨간 꽃 또는 꽃처럼 보이는 물체", "손과 빨간 물체를 강조한 근접 촬영"],
        "forbidden_elements": [
            "손 하트 모양을 확인할 수 없음",
            "하트 안에 빨간색 물체가 없음",
            "빨간 물체가 너무 작거나 가려져 색상을 식별할 수 없음",
        ],
        "min_people": 0,
        "max_people": None,
        "ocr_required": False,
        "weights": {"required": 0.85, "forbidden": 0.1, "reference": 0.05},
    },
    "DEMO_B09": {
        "required_elements": [
            "참가자 한 명 이상과 얼굴이 명확하게 보임",
            "한 손의 손바닥을 활짝 펴서 카메라 쪽으로 내밂",
            "눈을 크게 뜨거나 입을 벌리는 등 놀란 듯한 표정을 지음",
        ],
        "optional_elements": ["손바닥이 얼굴보다 카메라에 가깝게 보임", "뒤로 물러나는 듯한 과장된 몸짓"],
        "forbidden_elements": [
            "손바닥을 펴지 않았거나 카메라 방향으로 내밀지 않음",
            "얼굴이 가려져 놀란 표정을 확인할 수 없음",
            "일반 브이·엄지 척 포즈만 보임",
        ],
        "min_people": 1,
        "max_people": None,
        "ocr_required": False,
        "weights": {"required": 0.85, "forbidden": 0.1, "reference": 0.05},
    },
    "DEMO_B10": {
        "required_elements": [
            "참가자 한 명 이상이 명확하게 보임",
            "양손을 모두 주먹 쥠",
            "두 주먹을 어깨 근처 또는 그 위로 들어 올린 힘찬 파이팅 포즈",
        ],
        "optional_elements": ["팔을 굽혀 힘을 주는 자세", "밝고 자신감 있는 표정"],
        "forbidden_elements": [
            "한쪽 주먹만 들거나 양손이 모두 보이지 않음",
            "손을 펴거나 브이 포즈를 해 두 주먹 파이팅 자세가 아님",
            "팔이나 손이 잘려 포즈를 확인할 수 없음",
        ],
        "min_people": 1,
        "max_people": None,
        "ocr_required": False,
        "weights": {"required": 0.85, "forbidden": 0.1, "reference": 0.05},
    },
}


ENGLISH_CONTENT = {
    "DEMO_B01": (
        "Make the Busan Sea",
        "Fill the frame with blue objects—such as pens, tumblers, or clothing—to represent Gwangalli's blue sea.",
    ),
    "DEMO_B02": (
        "Seagull Wings",
        "Spread both arms wide and pose like a seagull in flight.",
    ),
    "DEMO_B03": (
        "Busan Seagull Sing-Along",
        "Everyone in the frame should open their mouth wide and look like they are singing together.",
    ),
    "DEMO_B04": (
        "Human Wave",
        "Capture two or three people linking their arms to create a wave motion.",
    ),
    "DEMO_B05": (
        "Slicing Sashimi",
        "Mime slicing sashimi with one flat hand in a karate-chop gesture.",
    ),
    "DEMO_B06": (
        "Slurp Some Milmyeon",
        "Use chopsticks—or two pens—and act out slurping noodles.",
    ),
    "DEMO_B07": (
        "Gwangan Bridge Arch",
        "Two people join hands above their heads to form a bridge-like arch.",
    ),
    "DEMO_B08": (
        "Camellia Heart",
        "Place a red object inside a hand heart to represent Busan's camellia.",
    ),
    "DEMO_B09": (
        "Hey! We're Friends!",
        "Hold an open palm toward the camera with a surprised expression.",
    ),
    "DEMO_B10": (
        "Jagalchi Ajimae, Fighting!",
        "Clench both fists, raise them, and strike an energetic fighting pose.",
    ),
}


ENGLISH_RULES = {
    "DEMO_B01": {
        "required_elements": [
            "At least one clearly visible blue object",
            "A participant is holding or displaying the blue object in front of their body",
            "The blue object covers a prominent area of the frame to represent the sea",
        ],
        "optional_elements": [
            "Several different kinds of blue objects",
            "An arrangement or motion suggesting waves or the sea",
        ],
        "forbidden_elements": [
            "No blue object is visible",
            "Blue appears only as a tiny decoration or background detail",
            "No participant is shown holding or displaying an object",
        ],
        "min_people": 1,
        "max_people": None,
        "ocr_required": False,
        "weights": {"required": 0.85, "forbidden": 0.1, "reference": 0.05},
    },
    "DEMO_B02": {
        "required_elements": [
            "At least one participant is clearly visible",
            "One participant has both arms spread wide to the sides",
            "The outstretched arms form a flying pose resembling seagull wings",
        ],
        "optional_elements": ["Arms extended near shoulder height", "A playful or dynamic expression"],
        "forbidden_elements": [
            "Only one arm is extended or both arms remain close to the body",
            "The upper body or arms are cropped so the pose cannot be verified",
            "Only a seagull or scenery is shown without a person",
        ],
        "min_people": 1,
        "max_people": None,
        "ocr_required": False,
        "weights": {"required": 0.85, "forbidden": 0.1, "reference": 0.05},
    },
    "DEMO_B03": {
        "required_elements": [
            "At least two participants are visible together",
            "Participants whose faces are visible have their mouths open wide",
            "The group looks like they are singing or chanting together",
        ],
        "optional_elements": ["Raised hands or a pretend microphone", "An excited group-cheering pose"],
        "forbidden_elements": [
            "Only one participant is visible",
            "Most participants have closed mouths and are posing for a normal group photo",
            "Faces are too small or obscured to verify singing expressions",
        ],
        "min_people": 2,
        "max_people": None,
        "ocr_required": False,
        "weights": {"required": 0.85, "forbidden": 0.1, "reference": 0.05},
    },
    "DEMO_B04": {
        "required_elements": [
            "At least two participants are visible together",
            "They connect through their arms, hands, or shoulders",
            "The connected arms or bodies vary in height to resemble a wave",
        ],
        "optional_elements": ["Two or three people standing in a line", "Tilted bodies that emphasize the wave"],
        "forbidden_elements": [
            "The participants are not connected",
            "Only one person is visible, so a group wave cannot be verified",
            "Arms or upper bodies are cropped so the connected wave pose cannot be judged",
        ],
        "min_people": 2,
        "max_people": None,
        "ocr_required": False,
        "weights": {"required": 0.85, "forbidden": 0.1, "reference": 0.05},
    },
    "DEMO_B05": {
        "required_elements": [
            "At least one participant is clearly visible",
            "One hand is flat with the fingers together and the hand edge upright",
            "The flat hand is posed as if making a slicing or karate-chop motion",
        ],
        "optional_elements": ["The other hand pretends to hold a board or ingredient", "A focused expression"],
        "forbidden_elements": [
            "The hand is obscured or cropped so the chopping gesture cannot be verified",
            "Only a fist or finger sign is shown instead of a slicing gesture",
            "Only a knife or food is shown without a person performing the gesture",
        ],
        "min_people": 1,
        "max_people": None,
        "ocr_required": False,
        "weights": {"required": 0.85, "forbidden": 0.1, "reference": 0.05},
    },
    "DEMO_B06": {
        "required_elements": [
            "At least one participant and their face are clearly visible",
            "Two thin, long objects such as chopsticks or pens are held together in one hand",
            "The two objects are held near the mouth while the participant acts out slurping noodles",
        ],
        "optional_elements": ["An open-mouth or pursed-lip slurping expression", "A gesture suggesting a noodle bowl"],
        "forbidden_elements": [
            "Two chopsticks or substitute objects are not visible",
            "The objects are too far from the mouth to resemble noodle slurping",
            "The face or mouth is obscured so the expression cannot be verified",
        ],
        "min_people": 1,
        "max_people": None,
        "ocr_required": False,
        "weights": {"required": 0.85, "forbidden": 0.1, "reference": 0.05},
    },
    "DEMO_B07": {
        "required_elements": [
            "Two main participants are visible together",
            "The two participants are holding each other's hands",
            "Their joined hands and arms are raised above their heads to form a bridge-like arch",
        ],
        "optional_elements": ["Their lower hands also join to outline a larger bridge", "The two participants face each other"],
        "forbidden_elements": [
            "Only one participant is visible",
            "The two participants' hands do not touch",
            "Their joined hands are not above their heads, so no arch is visible",
        ],
        "min_people": 2,
        "max_people": None,
        "ocr_required": False,
        "weights": {"required": 0.85, "forbidden": 0.1, "reference": 0.05},
    },
    "DEMO_B08": {
        "required_elements": [
            "A clearly recognizable heart shape made with fingers",
            "A red object placed inside the hand heart",
            "The red object and hand heart appear together as the main subject",
        ],
        "optional_elements": ["A red flower or flower-like object", "A close-up emphasizing the hands and red object"],
        "forbidden_elements": [
            "No recognizable hand-heart shape",
            "No red object inside the heart",
            "The red object is too small or obscured to identify its color",
        ],
        "min_people": 0,
        "max_people": None,
        "ocr_required": False,
        "weights": {"required": 0.85, "forbidden": 0.1, "reference": 0.05},
    },
    "DEMO_B09": {
        "required_elements": [
            "At least one participant and their face are clearly visible",
            "One hand is open with the palm extended toward the camera",
            "The participant has a surprised expression, such as wide eyes or an open mouth",
        ],
        "optional_elements": ["The palm appears closer to the camera than the face", "An exaggerated recoiling gesture"],
        "forbidden_elements": [
            "The palm is not open or is not extended toward the camera",
            "The face is obscured so the surprised expression cannot be verified",
            "Only a peace sign or thumbs-up pose is shown",
        ],
        "min_people": 1,
        "max_people": None,
        "ocr_required": False,
        "weights": {"required": 0.85, "forbidden": 0.1, "reference": 0.05},
    },
    "DEMO_B10": {
        "required_elements": [
            "At least one participant is clearly visible",
            "Both hands are clenched into fists",
            "Both fists are raised near or above the shoulders in an energetic fighting pose",
        ],
        "optional_elements": ["Bent arms showing strength", "A bright and confident expression"],
        "forbidden_elements": [
            "Only one fist is raised or both hands are not visible",
            "Open hands or peace signs are shown instead of two clenched fists",
            "The arms or hands are cropped so the pose cannot be verified",
        ],
        "min_people": 1,
        "max_people": None,
        "ocr_required": False,
        "weights": {"required": 0.85, "forbidden": 0.1, "reference": 0.05},
    },
}


def _seed_demo_missions(connection: sa.Connection) -> None:
    for sort_order, (code, (title, description)) in enumerate(DEMO_MISSIONS.items(), 1):
        connection.execute(
            sa.text(
                """
                INSERT INTO missions (
                    mission_set_id, code, theme, district_code, district_label,
                    place_label, type, title, description, verification_type,
                    target_photo_id, target_photo_url, emoji_url,
                    reward_item_name, reward_item_icon, sort_order
                )
                SELECT
                    id, :code, 'DEMO', 'DONGNAE', '동래구', '호텔농심',
                    'BASIC', :title, :description, 'PHOTO',
                    :code, :photo_url, :emoji_url, '', '', :sort_order
                FROM mission_sets
                WHERE theme = 'DEMO'
                ON CONFLICT (code) DO NOTHING
                """
            ),
            {
                "code": code,
                "title": title,
                "description": description,
                "photo_url": f"/missions/{code}/photo",
                "emoji_url": f"/static/mission-emoji/{code}_e.png",
                "sort_order": sort_order,
            },
        )


def upgrade() -> None:
    connection = op.get_bind()
    _seed_demo_missions(connection)

    for code, rules in RULES.items():
        connection.execute(
            sa.text(
                """
                UPDATE missions
                SET judgement_rules = CAST(:rules AS json),
                    updated_at = now()
                WHERE code = :code
                  AND theme = 'DEMO'
                """
            ),
            {"code": code, "rules": json.dumps(rules, ensure_ascii=False)},
        )

    for code, (title, description) in ENGLISH_CONTENT.items():
        connection.execute(
            sa.text(
                """
                INSERT INTO mission_translations (
                    mission_id, locale, title, description, place_label,
                    judgement_rules, reward_item_name
                )
                SELECT
                    id, 'en', :title, :description, 'Hotel Nongshim',
                    CAST(:rules AS json), ''
                FROM missions
                WHERE code = :code
                  AND theme = 'DEMO'
                ON CONFLICT (mission_id, locale) DO UPDATE SET
                    title = EXCLUDED.title,
                    description = EXCLUDED.description,
                    place_label = EXCLUDED.place_label,
                    judgement_rules = EXCLUDED.judgement_rules,
                    reward_item_name = EXCLUDED.reward_item_name,
                    updated_at = now()
                """
            ),
            {
                "code": code,
                "title": title,
                "description": description,
                "rules": json.dumps(ENGLISH_RULES[code], ensure_ascii=False),
            },
        )


def downgrade() -> None:
    connection = op.get_bind()
    connection.execute(
        sa.text(
            """
            DELETE FROM mission_translations
            WHERE locale = 'en'
              AND mission_id IN (
                  SELECT id FROM missions WHERE code IN :codes
              )
            """
        ).bindparams(sa.bindparam("codes", expanding=True)),
        {"codes": list(DEMO_MISSIONS)},
    )
    connection.execute(
        sa.text(
            """
            UPDATE missions
            SET judgement_rules = NULL,
                updated_at = now()
            WHERE code IN :codes
            """
        ).bindparams(sa.bindparam("codes", expanding=True)),
        {"codes": list(DEMO_MISSIONS)},
    )
