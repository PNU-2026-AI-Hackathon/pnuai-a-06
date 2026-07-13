from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models.schedules import (
    MissionSession,
    MissionSessionMember,
    MissionSubmission,
    MissionSchedule,
    ScheduleMember,
    ScheduleMission,
)


OPEN_SESSION_STATUSES = ("WAITING", "READY", "SHOOTING", "UPLOADING", "REVEALED")
ACTIVE_MISSION_STATUSES = ("SHOOTING", "UPLOADING", "REVEALED")


class ActiveMissionSessionConflict(Exception):
    def __init__(self, session: MissionSession):
        self.session = session
        super().__init__("Another mission is already active in this schedule.")


def _load_session(db: Session, session_id: int) -> MissionSession | None:
    session = db.scalar(
        select(MissionSession)
        .where(MissionSession.id == session_id)
        .options(
            selectinload(MissionSession.schedule_mission).selectinload(ScheduleMission.mission),
            selectinload(MissionSession.members).selectinload(MissionSessionMember.user),
            selectinload(MissionSession.submissions).selectinload(MissionSubmission.user),
        )
    )
    if session is not None:
        # Keep the response stable for clients that render the creator/companion
        # uploads side by side, and make sure the complete session collection is
        # returned rather than whichever row happened to be loaded first.
        session.members.sort(key=lambda member: (member.joined_at, member.id))
        session.submissions.sort(key=lambda submission: (submission.uploaded_at, submission.id))
    return session


def _accessible_schedule_mission(db: Session, schedule_id: int, user_id: int, schedule_mission_id: int):
    schedule = db.scalar(
        select(MissionSchedule)
        .where(MissionSchedule.id == schedule_id)
        .options(selectinload(MissionSchedule.members))
    )
    if schedule is None or not _can_participate(schedule, user_id):
        return None
    return db.scalar(
        select(ScheduleMission)
        .where(ScheduleMission.id == schedule_mission_id, ScheduleMission.schedule_id == schedule_id)
    )


def _can_participate(schedule: MissionSchedule, user_id: int) -> bool:
    return schedule.creator_id == user_id or any(
        member.user_id == user_id and member.status == "ACCEPTED"
        for member in schedule.members
    )


def _active_session_for_schedule(
    db: Session,
    schedule_id: int,
    excluded_schedule_mission_id: int | None = None,
) -> MissionSession | None:
    stmt = (
        select(MissionSession)
        .join(ScheduleMission, ScheduleMission.id == MissionSession.schedule_mission_id)
        .where(
            ScheduleMission.schedule_id == schedule_id,
            MissionSession.status.in_(ACTIVE_MISSION_STATUSES),
        )
        .order_by(MissionSession.started_at.desc(), MissionSession.id.desc())
    )
    if excluded_schedule_mission_id is not None:
        stmt = stmt.where(MissionSession.schedule_mission_id != excluded_schedule_mission_id)
    return db.scalar(stmt)


def _ensure_mission_is_allowed(
    db: Session,
    schedule_id: int,
    schedule_mission_id: int,
) -> None:
    active_session = _active_session_for_schedule(
        db, schedule_id, excluded_schedule_mission_id=schedule_mission_id
    )
    if active_session is not None:
        raise ActiveMissionSessionConflict(active_session)


def _add_session_member(db: Session, session: MissionSession, user_id: int) -> bool:
    if any(member.user_id == user_id for member in session.members):
        return False
    session.members.append(MissionSessionMember(user_id=user_id))
    return True


def create_session(db: Session, schedule_id: int, schedule_mission_id: int, user_id: int):
    schedule_mission = _accessible_schedule_mission(db, schedule_id, user_id, schedule_mission_id)
    if schedule_mission is None:
        return None
    _ensure_mission_is_allowed(db, schedule_id, schedule_mission.id)

    # Lock the parent row while checking/creating the shared session. This makes
    # concurrent creators for the same schedule mission observe the same state.
    schedule_mission = db.scalar(
        select(ScheduleMission)
        .where(ScheduleMission.id == schedule_mission.id)
        .with_for_update()
    )
    existing = db.scalar(
        select(MissionSession)
        .where(
            MissionSession.schedule_mission_id == schedule_mission.id,
            MissionSession.status.in_(OPEN_SESSION_STATUSES),
        )
        .order_by(MissionSession.created_at.desc(), MissionSession.id.desc())
    )
    if existing is not None:
        if _add_session_member(db, existing, user_id):
            db.commit()
        return _load_session(db, existing.id)
    session = MissionSession(
        schedule_mission_id=schedule_mission.id,
        created_by_user_id=user_id,
        status="WAITING",
    )
    db.add(session)
    db.flush()
    _add_session_member(db, session, user_id)
    try:
        db.commit()
    except IntegrityError:
        # The partial unique index is the final guard for concurrent requests.
        # Return the winner's session, which preserves the idempotent API
        # contract instead of surfacing a duplicate-key error.
        db.rollback()
        existing = db.scalar(
            select(MissionSession)
            .where(
                MissionSession.schedule_mission_id == schedule_mission.id,
                MissionSession.status.in_(OPEN_SESSION_STATUSES),
            )
            .order_by(MissionSession.created_at.desc(), MissionSession.id.desc())
        )
        return _load_session(db, existing.id) if existing is not None else None
    return _load_session(db, session.id)


def get_latest_session_for_schedule_mission(
    db: Session, schedule_id: int, schedule_mission_id: int, user_id: int
):
    schedule_mission = _accessible_schedule_mission(db, schedule_id, user_id, schedule_mission_id)
    if schedule_mission is None:
        return None
    session = db.scalar(
        select(MissionSession)
        .where(MissionSession.schedule_mission_id == schedule_mission.id)
        .where(MissionSession.status.in_(OPEN_SESSION_STATUSES))
        .order_by(MissionSession.created_at.desc(), MissionSession.id.desc())
    )
    if session is None:
        session = db.scalar(
            select(MissionSession)
            .where(MissionSession.schedule_mission_id == schedule_mission.id)
            .order_by(MissionSession.created_at.desc(), MissionSession.id.desc())
        )
    return _load_session(db, session.id) if session is not None else None


def get_session_for_user(db: Session, session_id: int, user_id: int):
    session = _load_session(db, session_id)
    if session is None:
        return None
    schedule = session.schedule_mission.schedule
    if schedule is None:
        schedule = db.scalar(
            select(MissionSchedule).where(MissionSchedule.id == session.schedule_mission.schedule_id)
        )
    return session if schedule and _can_participate(schedule, user_id) else None


def join_session(db: Session, session_id: int, user_id: int):
    session = _load_session(db, session_id)
    if session is None:
        return None
    schedule = db.scalar(
        select(MissionSchedule).where(MissionSchedule.id == session.schedule_mission.schedule_id)
        .options(selectinload(MissionSchedule.members))
    )
    if schedule is None or not _can_participate(schedule, user_id):
        return None
    _ensure_mission_is_allowed(
        db, schedule.id, session.schedule_mission_id
    )
    if _add_session_member(db, session, user_id):
        db.commit()
    return _load_session(db, session_id)


def mark_ready(db: Session, session_id: int, user_id: int):
    session = _load_session(db, session_id)
    if session is None:
        return None
    member = next((item for item in session.members if item.user_id == user_id), None)
    if member is None:
        return None
    _ensure_mission_is_allowed(
        db, session.schedule_mission.schedule_id, session.schedule_mission_id
    )
    member.ready_at = datetime.now(timezone.utc)
    if session.status == "WAITING":
        session.status = "READY"
    db.commit()
    return _load_session(db, session_id)


def start_session(db: Session, session_id: int, user_id: int):
    session = _load_session(db, session_id)
    if session is None or not any(member.user_id == user_id for member in session.members):
        return None
    _ensure_mission_is_allowed(
        db, session.schedule_mission.schedule_id, session.schedule_mission_id
    )
    session.status = "SHOOTING"
    session.started_at = datetime.now(timezone.utc)
    db.commit()
    return _load_session(db, session_id)


def add_submission(db: Session, session_id: int, user_id: int, storage_key: str, photo_url: str, captured_at):
    session = _load_session(db, session_id)
    if session is None or not any(member.user_id == user_id for member in session.members):
        return None
    _ensure_mission_is_allowed(
        db, session.schedule_mission.schedule_id, session.schedule_mission_id
    )
    submission = db.scalar(select(MissionSubmission).where(
        MissionSubmission.session_id == session_id, MissionSubmission.user_id == user_id
    ))
    if submission is None:
        submission = MissionSubmission(session_id=session_id, user_id=user_id,
                                       storage_key=storage_key, photo_url=photo_url,
                                       captured_at=captured_at)
        db.add(submission)
    else:
        submission.storage_key, submission.photo_url, submission.captured_at = storage_key, photo_url, captured_at
    session.status = "UPLOADING"
    db.commit()
    return db.scalar(select(MissionSubmission).where(MissionSubmission.id == submission.id)
                     .options(selectinload(MissionSubmission.user)))


def reveal_session(db: Session, session_id: int, user_id: int):
    session = _load_session(db, session_id)
    if session is None or session.created_by_user_id != user_id:
        return None
    session.status = "REVEALED"
    session.revealed_at = datetime.now(timezone.utc)
    db.commit()
    return _load_session(db, session_id)


def complete_session(db: Session, session_id: int, user_id: int):
    session = _load_session(db, session_id)
    if session is None or session.created_by_user_id != user_id:
        return None
    session.status = "COMPLETED"
    session.completed_at = datetime.now(timezone.utc)
    session.schedule_mission.status = "COMPLETED"
    db.commit()
    return _load_session(db, session_id)
