from collections.abc import Iterable

from app.models.missions import Mission, MissionLocation, MissionSet
from app.schemas.mission_sessions import MissionSessionResponse
from app.schemas.missions import (
    MissionLocationResponse,
    MissionResponse,
    MissionSetDetailResponse,
    MissionSetResponse,
)
from app.schemas.schedules import MissionScheduleResponse, ScheduleMissionResponse


DISTRICT_LABELS = {
    "GANGSEO": {"ko": "강서구", "en": "Gangseo-gu"},
    "GEUMJEONG": {"ko": "금정구", "en": "Geumjeong-gu"},
    "GIJANG": {"ko": "기장군", "en": "Gijang-gun"},
    "NAM": {"ko": "남구", "en": "Nam-gu"},
    "DONG": {"ko": "동구", "en": "Dong-gu"},
    "DONGNAE": {"ko": "동래구", "en": "Dongnae-gu"},
    "BUSANJIN": {"ko": "부산진구", "en": "Busanjin-gu"},
    "BUK": {"ko": "북구", "en": "Buk-gu"},
    "SASANG": {"ko": "사상구", "en": "Sasang-gu"},
    "SAHA": {"ko": "사하구", "en": "Saha-gu"},
    "SEO": {"ko": "서구", "en": "Seo-gu"},
    "SUYEONG": {"ko": "수영구", "en": "Suyeong-gu"},
    "YEONGDO": {"ko": "영도구", "en": "Yeongdo-gu"},
    "YEONJE": {"ko": "연제구", "en": "Yeonje-gu"},
    "JUNG": {"ko": "중구", "en": "Jung-gu"},
    "HAEUNDAE": {"ko": "해운대구", "en": "Haeundae-gu"},
    "ALL_BUSAN": {"ko": "부산 전역", "en": "All of Busan"},
}


def district_label(district_code: str, fallback: str, locale: str) -> str:
    return DISTRICT_LABELS.get(district_code, {}).get(locale, fallback)


def _translation(items: Iterable, locale: str):
    if locale == "ko":
        return None
    return next((item for item in items if item.locale == locale), None)


def localized_location(location: MissionLocation, locale: str) -> MissionLocationResponse:
    response = MissionLocationResponse.model_validate(location)
    translation = _translation(location.translations, locale)
    if translation is None or translation.label is None:
        return response
    return response.model_copy(update={"label": translation.label})


def localized_mission(mission: Mission, locale: str) -> MissionResponse:
    response = MissionResponse.model_validate(mission)
    translation = _translation(mission.translations, locale)
    updates = {
        "district_label": district_label(
            mission.district_code, mission.district_label, locale
        ),
        "locations": [localized_location(location, locale) for location in mission.locations],
    }
    if translation is not None:
        for field in (
            "title",
            "description",
            "unlock_condition",
            "place_label",
            "address",
            "target_keyword",
            "judgement_rules",
            "reward_item_name",
        ):
            value = getattr(translation, field)
            if value is not None:
                updates[field] = value
    return response.model_copy(update=updates)


def localized_mission_set(
    mission_set: MissionSet, locale: str, *, detail: bool = False
) -> MissionSetResponse | MissionSetDetailResponse:
    model = MissionSetDetailResponse if detail else MissionSetResponse
    response = model.model_validate(mission_set)
    translation = _translation(mission_set.translations, locale)
    updates = {}
    if translation is not None:
        for field in ("title", "region_label", "description"):
            value = getattr(translation, field)
            if value is not None:
                updates[field] = value
    if detail:
        updates["missions"] = [localized_mission(mission, locale) for mission in mission_set.missions]
    return response.model_copy(update=updates)


def localized_schedule_mission(
    schedule_mission, locale: str
) -> ScheduleMissionResponse:
    response = ScheduleMissionResponse.model_validate(schedule_mission)
    return response.model_copy(
        update={"mission": localized_mission(schedule_mission.mission, locale)}
    )


def localized_schedule(schedule, locale: str) -> MissionScheduleResponse:
    response = MissionScheduleResponse.model_validate(schedule)
    return response.model_copy(
        update={
            "missions": [
                localized_schedule_mission(item, locale)
                for item in schedule.schedule_missions
            ]
        }
    )


def localized_session(session, locale: str) -> MissionSessionResponse:
    response = MissionSessionResponse.model_validate(session)
    return response.model_copy(
        update={
            "mission": localized_mission(session.schedule_mission.mission, locale)
        }
    )
