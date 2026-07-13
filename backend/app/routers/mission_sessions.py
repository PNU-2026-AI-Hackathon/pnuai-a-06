from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.models.users import User
from app.schemas.mission_sessions import (
    MissionSessionResponse, MissionSubmissionResponse,
)
from app.services.mission_sessions import (
    ActiveMissionSessionConflict,
    add_submission, complete_session, create_session, get_session_for_user,
    get_latest_session_for_schedule_mission, join_session, mark_ready,
    reveal_session, start_session,
)
from app.services.storage import LocalStorageService

router = APIRouter(tags=["mission sessions"])
storage = LocalStorageService()


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


@router.get("/schedules/{schedule_id}/missions/{schedule_mission_id}/session", response_model=MissionSessionResponse)
def read_latest_mission_session(schedule_id: int, schedule_mission_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    result = get_latest_session_for_schedule_mission(db, schedule_id, schedule_mission_id, current_user.id)
    if result is None:
        raise HTTPException(status_code=404, detail="Mission session not found.")
    return result


@router.post("/schedules/{schedule_id}/missions/{schedule_mission_id}/sessions", response_model=MissionSessionResponse)
def create_mission_session(schedule_id: int, schedule_mission_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        result = create_session(db, schedule_id, schedule_mission_id, current_user.id)
    except ActiveMissionSessionConflict as error:
        _active_session_conflict(error)
    if result is None: _not_found()
    return result


@router.get("/mission-sessions/{session_id}", response_model=MissionSessionResponse)
def read_mission_session(session_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    result = get_session_for_user(db, session_id, current_user.id)
    if result is None: _not_found()
    return result


@router.post("/mission-sessions/{session_id}/join", response_model=MissionSessionResponse)
def join_mission_session(session_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        result = join_session(db, session_id, current_user.id)
    except ActiveMissionSessionConflict as error:
        _active_session_conflict(error)
    if result is None: _not_found()
    return result


@router.post("/mission-sessions/{session_id}/ready", response_model=MissionSessionResponse)
def ready_mission_session(session_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        result = mark_ready(db, session_id, current_user.id)
    except ActiveMissionSessionConflict as error:
        _active_session_conflict(error)
    if result is None: _not_found()
    return result


@router.post("/mission-sessions/{session_id}/start", response_model=MissionSessionResponse)
def start_mission_session(session_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        result = start_session(db, session_id, current_user.id)
    except ActiveMissionSessionConflict as error:
        _active_session_conflict(error)
    if result is None: _not_found()
    return result


@router.post("/mission-sessions/{session_id}/photo", response_model=MissionSubmissionResponse)
async def upload_mission_photo(session_id: int, photo: UploadFile = File(...), captured_at: datetime | None = None,
                               current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if photo.content_type is None or not photo.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="An image file is required.")
    key = f"submissions/{session_id}/{current_user.id}.jpg"
    await storage.save(photo, key)
    try:
        result = add_submission(db, session_id, current_user.id, key, f"/static/{key}", captured_at)
    except ActiveMissionSessionConflict as error:
        _active_session_conflict(error)
    if result is None: _not_found()
    return result


@router.post("/mission-sessions/{session_id}/reveal", response_model=MissionSessionResponse)
def reveal_mission_session(session_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    result = reveal_session(db, session_id, current_user.id)
    if result is None: _not_found()
    return result


@router.post("/mission-sessions/{session_id}/complete", response_model=MissionSessionResponse)
def finish_mission_session(session_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    result = complete_session(db, session_id, current_user.id)
    if result is None: _not_found()
    return result
