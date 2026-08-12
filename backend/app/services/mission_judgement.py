import base64
import json
import mimetypes
from datetime import datetime, timezone
from pathlib import Path

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models.schedules import (
    MissionSession,
    MissionSessionMember,
    MissionSubmission,
    MissionSubmissionComment,
    ScheduleMission,
)
from app.services.mission_session_ws import manager
from app.services.mission_session_timeouts import schedule_participant_timeout
from app.services.mission_sessions import apply_judgement_to_participant
from app.services.schedule_mission_ws import manager as schedule_mission_ws


OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"
STATIC_ROOT = Path("app/static").resolve()
MISSION_PHOTO_ROOT = STATIC_ROOT / "mission-photos"


def _image_data_url(path: Path) -> str:
    content_type = mimetypes.guess_type(path.name)[0] or "image/jpeg"
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{content_type};base64,{encoded}"


def _safe_static_path(storage_key: str) -> Path:
    path = (STATIC_ROOT / storage_key).resolve()
    if path != STATIC_ROOT and STATIC_ROOT not in path.parents:
        raise ValueError("Submission image path is outside static storage.")
    return path


def _load_submission(db: Session, submission_id: int) -> MissionSubmission | None:
    return db.scalar(
        select(MissionSubmission)
        .where(MissionSubmission.id == submission_id)
        .options(
            selectinload(MissionSubmission.session)
            .selectinload(MissionSession.schedule_mission)
            .selectinload(ScheduleMission.mission),
        )
    )


def _load_session_for_broadcast(db: Session, session_id: int) -> MissionSession | None:
    return db.scalar(
        select(MissionSession)
        .where(MissionSession.id == session_id)
        .options(
            selectinload(MissionSession.schedule_mission).selectinload(ScheduleMission.mission),
            selectinload(MissionSession.members).selectinload(MissionSessionMember.user),
            selectinload(MissionSession.submissions).selectinload(MissionSubmission.user),
            selectinload(MissionSession.submissions).selectinload(MissionSubmission.likes),
            selectinload(MissionSession.submissions)
            .selectinload(MissionSubmission.comments)
            .selectinload(MissionSubmissionComment.user),
        )
    )


def _result_schema() -> dict:
    criterion = {
        "type": "object",
        "properties": {
            "name": {"type": "string"},
            "score": {"type": "number"},
            "fulfilled": {"type": "boolean"},
            "evidence": {"type": "string"},
        },
        "required": ["name", "score", "fulfilled", "evidence"],
        "additionalProperties": False,
    }
    return {
        "type": "object",
        "properties": {
            "score": {"type": "number"},
            "decision": {"type": "string", "enum": ["PASS", "REVIEW", "FAIL"]},
            "reason": {"type": "string"},
            "criteria": {"type": "array", "items": criterion},
        },
        "required": ["score", "decision", "reason", "criteria"],
        "additionalProperties": False,
    }


def _request_body(submission: MissionSubmission, target_image: Path, user_image: Path) -> dict:
    mission = submission.session.schedule_mission.mission
    mission_details = "\n".join(
        value for value in (
            f"제목: {mission.title}",
            f"내용: {mission.description}" if mission.description else None,
            f"장소 힌트: {mission.place_label}" if mission.place_label else None,
            f"키워드: {mission.target_keyword}" if mission.target_keyword else None,
        ) if value
    )
    judgement_rules = json.dumps(
        mission.judgement_rules or {}, ensure_ascii=False, indent=2
    )
    prompt = f"""당신은 사진 미션 검수기입니다.
미션 정보:
{mission_details}

아래 JSON은 이 미션의 판정 규칙이다. 제목이나 예시 사진보다 이 규칙을 우선하여
사진에서 실제로 확인되는 요소만 평가하라. 확인할 수 없는 요소는 충족으로 추정하지 마라.
판정 규칙:
{judgement_rules}

첫 번째 이미지는 DB에 등록된 미션 예시 사진이고, 두 번째 이미지는 사용자가 제출한 사진입니다.
각 required_elements를 개별적으로 검사하고, forbidden_elements가 보이면 감점하세요.
사람 수·OCR·행동 조건은 사진에서 명확하게 보이는 경우에만 인정하세요.
사용자가 실제로 음식을 먹었는지, GPS 위치가 맞는지는 사진만으로 추정하지 마세요.
사람의 신원, GPS, 촬영 장소의 실제 위치는 이번 판정에서 사용하지 마세요.
사진에 미션 수행을 보여주는 글자나 물체가 있으면 OCR/시각적 증거로 고려하세요.
score는 0~100 정수에 가깝게 반환하고, 명확한 증거가 부족하면 REVIEW 또는 FAIL로 판단하세요.
PASS는 명확히 미션을 수행한 경우, FAIL은 미션과 무관하거나 조작/증거 부족인 경우입니다.
criteria에는 JSON 규칙의 필수 조건과 금지 조건을 각각 평가하고, evidence에는
사진에서 확인한 구체적인 근거를 적으세요."""
    return {
        "model": get_settings().openai_vision_model,
        "input": [{
            "role": "user",
            "content": [
                {"type": "input_text", "text": prompt},
                {"type": "input_image", "image_url": _image_data_url(target_image), "detail": "high"},
                {"type": "input_image", "image_url": _image_data_url(user_image), "detail": "high"},
            ],
        }],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "mission_judgement",
                "strict": True,
                "schema": _result_schema(),
            }
        },
    }


def _output_text(payload: dict) -> str:
    if isinstance(payload.get("output_text"), str):
        return payload["output_text"]
    for item in payload.get("output", []):
        for content in item.get("content", []):
            if content.get("type") == "output_text" and isinstance(content.get("text"), str):
                return content["text"]
    raise ValueError("OpenAI returned no structured judgement text.")


def _mark_error(
    db: Session, submission: MissionSubmission, reason: str
) -> datetime | None:
    submission.judge_status = "ERROR"
    submission.judge_reason = reason
    submission.judge_error = reason
    submission.judged_at = datetime.now(timezone.utc)
    deadline = apply_judgement_to_participant(submission, "ERROR")
    db.commit()
    return deadline


async def _publish_judgement(
    db: Session, submission: MissionSubmission, deadline: datetime | None
) -> None:
    session = _load_session_for_broadcast(db, submission.session_id)
    if session is None:
        return
    if session.status == "REVEALED":
        event_type = "commentary_started"
    elif session.status == "COMPLETED":
        event_type = "session_completed"
    elif session.status == "CANCELLED":
        event_type = "session_cancelled"
    else:
        event_type = "judgement_updated"
    await manager.broadcast_session(session, event_type)
    await schedule_mission_ws.broadcast_session(
        session.schedule_mission.schedule_id, session, event_type
    )
    if deadline is not None:
        schedule_participant_timeout(session.id, deadline)


async def judge_submission(submission_id: int) -> None:
    db = SessionLocal()
    try:
        submission = _load_submission(db, submission_id)
        if submission is None:
            return
        submission.judge_status = "PROCESSING"
        submission.judge_error = None
        db.commit()

        settings = get_settings()
        if not settings.openai_api_key:
            deadline = _mark_error(db, submission, "OPENAI_API_KEY is not configured.")
            await _publish_judgement(db, submission, deadline)
            return
        target_code = submission.session.schedule_mission.mission.target_photo_id or submission.session.schedule_mission.mission.code
        target_image = MISSION_PHOTO_ROOT / f"{target_code}.jpg"
        user_image = _safe_static_path(submission.storage_key)
        if not target_image.is_file():
            deadline = _mark_error(db, submission, "Mission target image is not available.")
            await _publish_judgement(db, submission, deadline)
            return
        if not user_image.is_file():
            deadline = _mark_error(db, submission, "Submitted image is not available.")
            await _publish_judgement(db, submission, deadline)
            return

        try:
            async with httpx.AsyncClient(timeout=settings.openai_vision_timeout_seconds) as client:
                response = await client.post(
                    OPENAI_RESPONSES_URL,
                    headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                    json=_request_body(submission, target_image, user_image),
                )
                response.raise_for_status()
                result = json.loads(_output_text(response.json()))
        except Exception as error:
            deadline = _mark_error(
                db, submission, f"Mission judgement request failed: {error}"
            )
            await _publish_judgement(db, submission, deadline)
            return

        score = max(0.0, min(100.0, float(result.get("score", 0))))
        decision = str(result.get("decision", "FAIL")).upper()
        status = (
            "PASSED"
            if decision == "PASS" and score >= settings.mission_judgement_pass_score
            else "REJECTED"
        )
        submission.judge_status = status
        submission.similarity_score = score
        submission.judge_reason = str(result.get("reason", ""))
        submission.judge_model = settings.openai_vision_model
        submission.judged_at = datetime.now(timezone.utc)
        submission.judge_error = None
        deadline = apply_judgement_to_participant(submission, status)
        db.commit()
        await _publish_judgement(db, submission, deadline)
    finally:
        db.close()
