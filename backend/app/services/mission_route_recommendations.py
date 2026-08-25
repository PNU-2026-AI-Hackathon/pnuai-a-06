import json
import logging
import time
from datetime import date

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.models.missions import Mission, MissionLocation
from app.models.schedules import MissionSchedule, ScheduleMission


OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"
logger = logging.getLogger("app.mission_route_recommendations")


class MissionRouteRecommendationError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def _day_mission_load_options():
    return (
        selectinload(ScheduleMission.mission).selectinload(Mission.translations),
        selectinload(ScheduleMission.mission)
        .selectinload(Mission.locations)
        .selectinload(MissionLocation.translations),
        selectinload(ScheduleMission.winner),
    )


def _load_day_missions(
    db: Session,
    *,
    schedule_id: int,
    planned_date: date,
    for_update: bool = False,
) -> list[ScheduleMission]:
    statement = (
        select(ScheduleMission)
        .where(
            ScheduleMission.schedule_id == schedule_id,
            ScheduleMission.planned_date == planned_date,
        )
        .options(*_day_mission_load_options())
        .order_by(
            ScheduleMission.visit_order,
            ScheduleMission.created_at,
            ScheduleMission.id,
        )
    )
    if for_update:
        statement = statement.with_for_update()
    return list(db.scalars(statement).all())


def _candidate_payload(schedule_missions: list[ScheduleMission]) -> list[dict]:
    candidates: list[dict] = []
    for schedule_mission in schedule_missions:
        mission = schedule_mission.mission
        candidates.append(
            {
                "schedule_mission_id": schedule_mission.id,
                "mission_code": mission.code,
                "title": mission.title,
                "district": mission.district_label,
                "place": mission.place_label,
                "address": mission.address,
                "locations": [
                    {
                        "label": location.label,
                        "latitude": location.latitude,
                        "longitude": location.longitude,
                    }
                    for location in mission.locations
                ],
            }
        )
    return candidates


def _result_schema(candidate_ids: list[int]) -> dict:
    return {
        "type": "object",
        "properties": {
            "ordered_schedule_mission_ids": {
                "type": "array",
                "items": {
                    "type": "integer",
                    "enum": candidate_ids,
                },
                "minItems": len(candidate_ids),
                "maxItems": len(candidate_ids),
            }
        },
        "required": ["ordered_schedule_mission_ids"],
        "additionalProperties": False,
    }


def _request_body(candidates: list[dict], model: str) -> dict:
    candidate_ids = [candidate["schedule_mission_id"] for candidate in candidates]
    prompt = f"""아래는 부산 여행의 같은 날짜에 방문할 미션 목록이다.
실시간 길찾기 정보는 없으므로 제공된 위도·경도, 상세 주소, 장소명과 행정구역을 바탕으로
이동 동선이 대략 짧고 자연스럽도록 모든 미션의 방문 순서를 추천하라.
가능하면 서로 가까운 장소를 연속으로 배치하고 부산을 불필요하게 왕복하지 않도록 하라.
목록의 schedule_mission_id를 정확히 한 번씩만 사용하고 누락하거나 새 ID를 만들지 마라.

미션 목록:
{json.dumps(candidates, ensure_ascii=False)}"""
    return {
        "model": model,
        "store": False,
        "input": [
            {
                "role": "user",
                "content": [{"type": "input_text", "text": prompt}],
            }
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "mission_visit_order",
                "strict": True,
                "schema": _result_schema(candidate_ids),
            }
        },
    }


def _output_text(payload: dict) -> str:
    if isinstance(payload.get("output_text"), str):
        return payload["output_text"]
    for item in payload.get("output", []):
        for content in item.get("content", []):
            if content.get("type") == "output_text" and isinstance(
                content.get("text"), str
            ):
                return content["text"]
    raise ValueError("OpenAI returned no structured route recommendation.")


def _validate_recommended_order(result: object, candidate_ids: list[int]) -> list[int]:
    if not isinstance(result, dict):
        raise ValueError("OpenAI route recommendation is not an object.")
    ordered_ids = result.get("ordered_schedule_mission_ids")
    if not isinstance(ordered_ids, list) or any(
        isinstance(item, bool) or not isinstance(item, int) for item in ordered_ids
    ):
        raise ValueError("OpenAI route recommendation does not contain integer ids.")
    if len(ordered_ids) != len(candidate_ids):
        raise ValueError("OpenAI route recommendation omitted or added missions.")
    if len(set(ordered_ids)) != len(ordered_ids):
        raise ValueError("OpenAI route recommendation contains duplicate missions.")
    if set(ordered_ids) != set(candidate_ids):
        raise ValueError("OpenAI route recommendation contains unexpected missions.")
    return ordered_ids


def _request_recommended_order(candidates: list[dict]) -> list[int]:
    settings = get_settings()
    if not settings.openai_api_key:
        raise MissionRouteRecommendationError(
            "OPENAI_NOT_CONFIGURED",
            "OPENAI_API_KEY is not configured.",
        )

    candidate_ids = [candidate["schedule_mission_id"] for candidate in candidates]
    try:
        with httpx.Client(timeout=settings.openai_route_timeout_seconds) as client:
            response = client.post(
                OPENAI_RESPONSES_URL,
                headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                json=_request_body(candidates, settings.openai_route_model),
            )
            response.raise_for_status()
            result = json.loads(_output_text(response.json()))
        return _validate_recommended_order(result, candidate_ids)
    except Exception as error:
        logger.warning("OpenAI route recommendation failed: %s", error)
        raise MissionRouteRecommendationError(
            "ROUTE_RECOMMENDATION_UNAVAILABLE",
            "The route recommendation could not be generated.",
        ) from error


def recommend_schedule_mission_order(
    db: Session,
    *,
    schedule_id: int,
    creator_id: int,
    planned_date: date,
) -> list[ScheduleMission]:
    started_at = time.perf_counter()
    schedule = db.get(MissionSchedule, schedule_id)
    if schedule is None or schedule.creator_id != creator_id:
        raise MissionRouteRecommendationError(
            "SCHEDULE_NOT_FOUND",
            "Schedule was not found or the user is not the creator.",
        )
    if not (schedule.start_date <= planned_date <= schedule.end_date):
        raise MissionRouteRecommendationError(
            "MISSION_DATE_OUT_OF_RANGE",
            "planned_date must be within the schedule date range.",
        )

    schedule_missions = _load_day_missions(
        db,
        schedule_id=schedule_id,
        planned_date=planned_date,
    )
    if not schedule_missions:
        raise MissionRouteRecommendationError(
            "NO_MISSIONS_FOR_DATE",
            "There are no missions planned for this date.",
        )

    candidates = _candidate_payload(schedule_missions)
    candidate_ids = [candidate["schedule_mission_id"] for candidate in candidates]

    # Do not reserve a pooled DB connection while waiting on the external API.
    db.rollback()
    ordered_ids = (
        candidate_ids if len(candidate_ids) == 1 else _request_recommended_order(candidates)
    )
    try:
        # Keep a validation boundary immediately before the write as well. This
        # protects the database if the OpenAI adapter is changed or mocked later.
        ordered_ids = _validate_recommended_order(
            {"ordered_schedule_mission_ids": ordered_ids},
            candidate_ids,
        )
    except ValueError as error:
        raise MissionRouteRecommendationError(
            "ROUTE_RECOMMENDATION_UNAVAILABLE",
            "The route recommendation could not be validated.",
        ) from error

    current_missions = _load_day_missions(
        db,
        schedule_id=schedule_id,
        planned_date=planned_date,
        for_update=True,
    )
    current_ids = [mission.id for mission in current_missions]
    if set(current_ids) != set(candidate_ids) or len(current_ids) != len(candidate_ids):
        db.rollback()
        raise MissionRouteRecommendationError(
            "SCHEDULE_MISSIONS_CHANGED",
            "The missions for this date changed while generating the recommendation.",
        )

    missions_by_id = {mission.id: mission for mission in current_missions}
    for position, schedule_mission_id in enumerate(ordered_ids, start=1):
        missions_by_id[schedule_mission_id].visit_order = position
    db.commit()

    result = _load_day_missions(
        db,
        schedule_id=schedule_id,
        planned_date=planned_date,
    )
    logger.info(
        "route recommendation applied schedule_id=%s planned_date=%s mission_count=%s model=%s duration_ms=%.2f",
        schedule_id,
        planned_date,
        len(result),
        get_settings().openai_route_model if len(candidate_ids) > 1 else "not_required",
        (time.perf_counter() - started_at) * 1000,
    )
    return result
