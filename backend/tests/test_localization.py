from datetime import datetime, timezone
from types import SimpleNamespace
import unittest

from fastapi import HTTPException

from app.core.localization import _preferred_header_locale, normalize_locale
from app.services.localization import district_label, localized_mission


def make_mission(*, with_translation: bool = True) -> SimpleNamespace:
    now = datetime.now(timezone.utc)
    translation = SimpleNamespace(
        locale="en",
        title="Do You Like Surfing?",
        description="Spot someone surfing in the sea and take a photo!",
        unlock_condition=None,
        place_label="Songjeong Beach",
        address="62 Songjeonghaebyeon-ro, Haeundae-gu, Busan",
        target_keyword=None,
        judgement_rules=None,
        reward_item_name="Surfboard",
    )
    location = SimpleNamespace(
        id=1,
        label="송정",
        latitude=35.178,
        longitude=129.199,
        allowed_radius_m=300,
        translations=[SimpleNamespace(locale="en", label="Songjeong Beach")],
    )
    return SimpleNamespace(
        id=1,
        mission_set_id=2,
        code="SEA_B01",
        theme="SEA",
        district_code="HAEUNDAE",
        district_label="해운대구",
        place_label="송정",
        address="부산광역시 해운대구 송정해변로 62",
        type="BASIC",
        title="서핑 좋아하세요?",
        description="바다에서 서핑하는 사람 발견해서 사진 찍기!",
        unlock_condition=None,
        verification_type="GPS_PHOTO",
        target_keyword=None,
        target_photo_id="SEA_B01",
        target_photo_url="/missions/SEA_B01/photo",
        emoji_url=None,
        judgement_rules={"required_elements": ["바다"]},
        reward_item_name="서핑보드",
        reward_item_icon="",
        sort_order=1,
        created_at=now,
        updated_at=now,
        translations=[translation] if with_translation else [],
        locations=[location],
    )


class LocalizationTest(unittest.TestCase):
    def test_query_style_locale_normalization(self):
        self.assertEqual(normalize_locale("en-US"), "en")
        self.assertEqual(normalize_locale("ko_KR"), "ko")
        with self.assertRaises(HTTPException):
            normalize_locale("fr", strict=True)

    def test_accept_language_ignores_unsupported_language(self):
        self.assertEqual(_preferred_header_locale("fr-FR, en;q=0.8"), "en")
        self.assertEqual(_preferred_header_locale("ko-KR;q=0.7, en;q=0.9"), "en")
        self.assertEqual(_preferred_header_locale("fr-FR"), "ko")

    def test_mission_uses_english_translation_and_district_label(self):
        response = localized_mission(make_mission(), "en")

        self.assertEqual(response.title, "Do You Like Surfing?")
        self.assertEqual(response.district_label, "Haeundae-gu")
        self.assertEqual(response.place_label, "Songjeong Beach")
        self.assertEqual(
            response.address, "62 Songjeonghaebyeon-ro, Haeundae-gu, Busan"
        )
        self.assertEqual(response.locations[0].label, "Songjeong Beach")
        # An untranslated field falls back independently to the Korean source.
        self.assertEqual(response.judgement_rules, {"required_elements": ["바다"]})

    def test_missing_translation_falls_back_to_korean(self):
        response = localized_mission(make_mission(with_translation=False), "en")

        self.assertEqual(response.title, "서핑 좋아하세요?")
        self.assertEqual(response.district_label, "Haeundae-gu")

    def test_district_mapping_has_korean_and_english_values(self):
        self.assertEqual(district_label("JUNG", "중구", "ko"), "중구")
        self.assertEqual(district_label("JUNG", "중구", "en"), "Jung-gu")


if __name__ == "__main__":
    unittest.main()
