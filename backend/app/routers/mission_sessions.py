from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.models.users import User
from app.schemas.mission_sessions import (
    MissionParticipationRequest, MissionSessionResponse, MissionSubmissionCommentCreateRequest,
    MissionSubmissionCommentResponse, MissionSubmissionResponse,
)
from app.services.mission_sessions import (
    ActiveMissionSessionConflict,
    MissionLocationValidationError,
    MissionSessionExpired,
    NoParticipants,
    ParticipationLocked,
    ParticipationNotAllowed,
    SubmissionCommentAlreadyExists,
    SubmissionAlreadyExists,
    VotingNotReady,
    VotingSessionExpired,
    add_submission, complete_session, create_session, get_session_for_user,
    get_active_session_for_schedule, get_latest_session_for_schedule_mission,
    can_access_schedule, ensure_can_add_submission, join_session, mark_ready,
    reveal_session, start_session, add_submission_comment, like_submission,
    set_participation,
)
from app.services.storage import LocalStorageService
from app.core.security import decode_access_token
from app.db.session import SessionLocal
from app.models.schedules import MissionSession
from app.services.mission_session_ws import manager as mission_session_ws
from app.services.mission_session_timeouts import (
    schedule_participant_timeout,
    schedule_voting_timeout,
)
from app.services.mission_judgement import judge_submission
from app.services.schedule_mission_ws import manager as schedule_mission_ws
from app.core.localization import normalize_locale, resolve_locale
from app.services.localization import localized_session

router = APIRouter(tags=["mission sessions"])
storage = LocalStorageService()


async def _broadcast_session(session, event_type: str = "session_updated") -> None:
    await mission_session_ws.broadcast_session(session, event_type)
    await schedule_mission_ws.broadcast_session(
        session.schedule_mission.schedule_id, session, event_type
    )


@router.websocket("/schedules/{schedule_id}/mission-sessions/ws")
async def schedule_mission_socket(
    schedule_id: int, websocket: WebSocket, token: str, lang: str | None = None
):
    locale = normalize_locale(lang)
    user_id = decode_access_token(token)
    db = SessionLocal()
    try:
        user = db.get(User, int(user_id)) if user_id and user_id.isdigit() else None
        if user is None or not can_access_schedule(db, schedule_id, user.id):
            await websocket.close(code=1008, reason="Invalid authentication or schedule.")
            return
        active_session = get_active_session_for_schedule(db, schedule_id, user.id)
    finally:
        # A WebSocket can remain open for hours. Never reserve a pooled DB
        # connection for the lifetime of the socket after its snapshot is built.
        db.close()

    await schedule_mission_ws.connect(schedule_id, websocket, locale)
    try:
        await schedule_mission_ws.send_snapshot(
            websocket, schedule_id, active_session, locale
        )
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await schedule_mission_ws.disconnect(schedule_id, websocket)


@router.websocket("/mission-sessions/{session_id}/ws")
async def mission_session_socket(
    session_id: int, websocket: WebSocket, token: str, lang: str | None = None
):
    locale = normalize_locale(lang)
    user_id = decode_access_token(token)
    db = SessionLocal()
    try:
        user = db.get(User, int(user_id)) if user_id and user_id.isdigit() else None
        session = db.scalar(
            select(MissionSession).where(MissionSession.id == session_id)
        )
        if user is None or session is None:
            await websocket.close(code=1008, reason="Invalid authentication or session.")
            return
        accessible_session = get_session_for_user(db, session_id, user.id)
        if accessible_session is None:
            await websocket.close(code=1008, reason="You cannot access this mission session.")
            return
    finally:
        db.close()

    await mission_session_ws.connect(session_id, websocket, locale)
    try:
        await mission_session_ws.send_session(
            websocket, accessible_session, locale=locale
        )
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await mission_session_ws.disconnect(session_id, websocket)


def _not_found():
    raise HTTPException(status_code=404, detail="Mission session not found.")


def _active_session_conflict(error: ActiveMissionSessionConflict):
    raise HTTPException(
        status_code=409,
        detail={
            "message": "Another mission is already active in this schedule.",
            "activeSessionId": error.session.id,
            "activeScheduleMissionId": error.session.schedule_mission_id,
        },
    )


def _session_expired():
    raise HTTPException(status_code=410, detail="Mission session expired after 30 minutes.")


def _voting_expired():
    raise HTTPException(status_code=410, detail="Voting has ended for this mission session.")


def _location_validation_error(error: MissionLocationValidationError):
    detail = {
        "code": error.code,
        "message": str(error),
        "distance_m": error.distance_m,
        "allowed_radius_m": error.allowed_radius_m,
        "accuracy_m": error.accuracy_m,
        "max_accuracy_m": error.max_accuracy_m,
    }
    raise HTTPException(
        status_code=409,
        detail={key: value for key, value in detail.items() if value is not None},
    ) from error


@router.get("/schedules/{schedule_id}/missions/{schedule_mission_id}/session", response_model=MissionSessionResponse)
def read_latest_mission_session(
    schedule_id: int,
    schedule_mission_id: int,
    locale: str = Depends(resolve_locale),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = get_latest_session_for_schedule_mission(db, schedule_id, schedule_mission_id, current_user.id)
    if result is None:
        raise HTTPException(status_code=404, detail="Mission session not found.")
    return localized_session(result, locale)


@router.get(
    "/schedules/{schedule_id}/active-mission-session",
    response_model=MissionSessionResponse,
    summary="Get the active mission session for a schedule",
    responses={404: {"description": "No active mission session was found."}},
)
def read_active_schedule_mission_session(
    schedule_id: int,
    locale: str = Depends(resolve_locale),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = get_active_session_for_schedule(db, schedule_id, current_user.id)
    if result is None:
        raise HTTPException(status_code=404, detail="No active mission session found.")
    return localized_session(result, locale)


@router.post("/schedules/{schedule_id}/missions/{schedule_mission_id}/sessions", response_model=MissionSessionResponse)
async def create_mission_session(
    schedule_id: int,
    schedule_mission_id: int,
    locale: str = Depends(resolve_locale),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        result = create_session(db, schedule_id, schedule_mission_id, current_user.id)
    except ActiveMissionSessionConflict as error:
        _active_session_conflict(error)
    if result is None: _not_found()
    await _broadcast_session(result, "mission_session_created")
    return localized_session(result, locale)


@router.get("/mission-sessions/{session_id}", response_model=MissionSessionResponse)
def read_mission_session(
    session_id: int,
    locale: str = Depends(resolve_locale),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = get_session_for_user(db, session_id, current_user.id)
    if result is None: _not_found()
    return localized_session(result, locale)


@router.post("/mission-sessions/{session_id}/join", response_model=MissionSessionResponse)
async def join_mission_session(
    session_id: int,
    locale: str = Depends(resolve_locale),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        result = join_session(db, session_id, current_user.id)
    except ActiveMissionSessionConflict as error:
        _active_session_conflict(error)
    except MissionSessionExpired:
        _session_expired()
    except VotingSessionExpired:
        _voting_expired()
    except ParticipationLocked as error:
        raise HTTPException(status_code=409, detail=str(error))
    except MissionLocationValidationError as error:
        _location_validation_error(error)
    if result is None: _not_found()
    await _broadcast_session(result, "participation_updated")
    return localized_session(result, locale)


@router.post(
    "/mission-sessions/{session_id}/participation",
    response_model=MissionSessionResponse,
)
async def choose_mission_participation(
    session_id: int,
    payload: MissionParticipationRequest,
    locale: str = Depends(resolve_locale),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        result = set_participation(
            db,
            session_id,
            current_user.id,
            payload.decision.value,
            latitude=payload.latitude,
            longitude=payload.longitude,
            accuracy_m=payload.accuracy_m,
            measured_at=payload.measured_at,
        )
    except ActiveMissionSessionConflict as error:
        _active_session_conflict(error)
    except ParticipationLocked as error:
        raise HTTPException(status_code=409, detail=str(error))
    except MissionLocationValidationError as error:
        _location_validation_error(error)
    except MissionSessionExpired:
        _session_expired()
    except VotingSessionExpired:
        _voting_expired()
    if result is None:
        _not_found()
    await _broadcast_session(result, "participation_updated")
    return localized_session(result, locale)


@router.post("/mission-sessions/{session_id}/ready", response_model=MissionSessionResponse)
async def ready_mission_session(
    session_id: int,
    locale: str = Depends(resolve_locale),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        result = mark_ready(db, session_id, current_user.id)
    except ActiveMissionSessionConflict as error:
        _active_session_conflict(error)
    except MissionSessionExpired:
        _session_expired()
    except VotingSessionExpired:
        _voting_expired()
    except ParticipationLocked as error:
        raise HTTPException(status_code=409, detail=str(error))
    except MissionLocationValidationError as error:
        _location_validation_error(error)
    if result is None: _not_found()
    await _broadcast_session(result, "participation_updated")
    return localized_session(result, locale)


@router.post("/mission-sessions/{session_id}/start", response_model=MissionSessionResponse)
async def start_mission_session(
    session_id: int,
    locale: str = Depends(resolve_locale),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        result = start_session(db, session_id, current_user.id)
    except ActiveMissionSessionConflict as error:
        _active_session_conflict(error)
    except MissionSessionExpired:
        _session_expired()
    except VotingSessionExpired:
        _voting_expired()
    except ParticipationLocked as error:
        raise HTTPException(status_code=409, detail=str(error))
    except NoParticipants as error:
        raise HTTPException(status_code=409, detail=str(error))
    if result is None: _not_found()
    if result.shooting_deadline_at is not None:
        schedule_participant_timeout(result.id, result.shooting_deadline_at)
    await _broadcast_session(result, "session_started")
    return localized_session(result, locale)


@router.post("/mission-sessions/{session_id}/photo", response_model=MissionSubmissionResponse)
async def upload_mission_photo(session_id: int, background_tasks: BackgroundTasks, photo: UploadFile = File(...), captured_at: datetime | None = None,
                               current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if photo.content_type is None or not photo.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="An image file is required.")
    try:
        if not ensure_can_add_submission(db, session_id, current_user.id):
            _not_found()
    except SubmissionAlreadyExists as error:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "You have already submitted a photo for this mission session.",
                "submissionId": error.submission.id,
            },
        )
    except ActiveMissionSessionConflict as error:
        _active_session_conflict(error)
    except MissionSessionExpired:
        _session_expired()
    except VotingSessionExpired:
        _voting_expired()
    except ParticipationNotAllowed as error:
        raise HTTPException(status_code=409, detail=str(error))
    key = f"submissions/{session_id}/{current_user.id}.jpg"
    await storage.save(photo, key)
    try:
        result = add_submission(db, session_id, current_user.id, key, f"/static/{key}", captured_at)
    except SubmissionAlreadyExists as error:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "You have already submitted a photo for this mission session.",
                "submissionId": error.submission.id,
            },
        )
    except ActiveMissionSessionConflict as error:
        _active_session_conflict(error)
    except MissionSessionExpired:
        _session_expired()
    except VotingSessionExpired:
        _voting_expired()
    except ParticipationNotAllowed as error:
        raise HTTPException(status_code=409, detail=str(error))
    if result is None: _not_found()
    session_state = get_session_for_user(db, session_id, current_user.id)
    if session_state is not None:
        await _broadcast_session(session_state, "photo_uploaded")
        if session_state.status == "VOTING":
            await _broadcast_session(session_state, "voting_started")
    background_tasks.add_task(judge_submission, result.id)
    return result


@router.post("/mission-sessions/{session_id}/reveal", response_model=MissionSessionResponse)
async def reveal_mission_session(
    session_id: int,
    locale: str = Depends(resolve_locale),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        result = reveal_session(db, session_id, current_user.id)
    except MissionSessionExpired:
        _session_expired()
    except VotingSessionExpired:
        _voting_expired()
    except VotingNotReady as error:
        raise HTTPException(status_code=409, detail=str(error))
    if result is None: _not_found()
    await _broadcast_session(result)
    return localized_session(result, locale)


@router.post("/mission-sessions/{session_id}/complete", response_model=MissionSessionResponse)
async def finish_mission_session(
    session_id: int,
    locale: str = Depends(resolve_locale),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        result = complete_session(db, session_id, current_user.id)
    except MissionSessionExpired:
        _session_expired()
    except VotingSessionExpired:
        _voting_expired()
    if result is None: _not_found()
    await _broadcast_session(result, "session_completed")
    return localized_session(result, locale)


@router.post(
    "/mission-sessions/{session_id}/submissions/{submission_id}/comments",
    response_model=MissionSubmissionCommentResponse,
)
async def comment_on_submission(
    session_id: int,
    submission_id: int,
    payload: MissionSubmissionCommentCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        result = add_submission_comment(
            db, session_id, submission_id, current_user.id, payload.content
        )
    except VotingSessionExpired:
        _voting_expired()
    except VotingNotReady as error:
        raise HTTPException(status_code=409, detail=str(error))
    except SubmissionCommentAlreadyExists as error:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "You have already commented on this photo.",
                "commentId": error.comment.id,
            },
        )
    if result is None:
        _not_found()
    session = get_session_for_user(db, session_id, current_user.id)
    if session is not None:
        await _broadcast_session(session, "comment_added")
        if session.status == "VOTING":
            if session.voting_expires_at is not None:
                schedule_voting_timeout(session.id, session.voting_expires_at)
            await _broadcast_session(session, "voting_started")
    return result


@router.post(
    "/mission-sessions/{session_id}/submissions/{submission_id}/like",
    response_model=MissionSubmissionResponse,
)
async def like_mission_submission(
    session_id: int,
    submission_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        result, error = like_submission(db, session_id, submission_id, current_user.id)
    except VotingSessionExpired:
        _voting_expired()
    if error == "self_like":
        raise HTTPException(status_code=400, detail="You cannot like your own submission.")
    if result is None:
        _not_found()
    session = get_session_for_user(db, session_id, current_user.id)
    if session is not None:
        event_type = "session_completed" if session.status == "COMPLETED" else "like_updated"
        await _broadcast_session(session, event_type)
    return result
