import asyncio
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.session import SessionLocal
from app.models.schedules import MissionSession
from app.services.mission_session_ws import manager as mission_session_ws
from app.services.mission_sessions import expire_session_participants, finalize_voting_session
from app.services.schedule_mission_ws import manager as schedule_mission_ws


_timeout_tasks: set[asyncio.Task] = set()


def schedule_participant_timeout(session_id: int, deadline: datetime) -> None:
    task = asyncio.create_task(wait_for_participant_timeout(session_id, deadline))
    _timeout_tasks.add(task)
    task.add_done_callback(_timeout_tasks.discard)


def schedule_voting_timeout(session_id: int, deadline: datetime) -> None:
    task = asyncio.create_task(wait_for_voting_timeout(session_id, deadline))
    _timeout_tasks.add(task)
    task.add_done_callback(_timeout_tasks.discard)


def restore_pending_timeouts() -> None:
    db = SessionLocal()
    try:
        sessions = db.scalars(
            select(MissionSession)
            .where(MissionSession.status.in_(("SHOOTING", "UPLOADING", "VOTING")))
            .options(selectinload(MissionSession.members))
        ).all()
        for session in sessions:
            if session.status == "VOTING" and session.voting_expires_at is not None:
                schedule_voting_timeout(session.id, session.voting_expires_at)
                continue
            deadlines = {
                member.upload_deadline_at or session.shooting_deadline_at
                for member in session.members
                if member.participation_status == "PARTICIPATING"
            }
            for deadline in deadlines - {None}:
                schedule_participant_timeout(session.id, deadline)
    finally:
        db.close()


def _event_type(status: str) -> str:
    if status == "REVEALED":
        return "commentary_started"
    if status == "COMPLETED":
        return "session_completed"
    if status == "CANCELLED":
        return "session_cancelled"
    return "participant_timeout"


async def wait_for_participant_timeout(session_id: int, deadline: datetime) -> None:
    while True:
        remaining = (deadline - datetime.now(timezone.utc)).total_seconds()
        if remaining <= 0:
            break
        await asyncio.sleep(min(remaining, 60))

    db = SessionLocal()
    try:
        session = expire_session_participants(db, session_id)
        if session is None:
            return
        event_type = _event_type(session.status)
        await mission_session_ws.broadcast_session(session, event_type)
        await schedule_mission_ws.broadcast_session(
            session.schedule_mission.schedule_id, session, event_type
        )
    finally:
        db.close()


async def wait_for_voting_timeout(session_id: int, deadline: datetime) -> None:
    while True:
        remaining = (deadline - datetime.now(timezone.utc)).total_seconds()
        if remaining <= 0:
            break
        await asyncio.sleep(min(remaining, 60))

    db = SessionLocal()
    try:
        session = finalize_voting_session(db, session_id)
        if session is None or session.status != "COMPLETED":
            return
        await mission_session_ws.broadcast_session(session, "session_completed")
        await schedule_mission_ws.broadcast_session(
            session.schedule_mission.schedule_id, session, "session_completed"
        )
    finally:
        db.close()
