from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.models.schedules import (
    MissionSession,
    MissionSessionMember,
    MissionSubmission,
    MissionSubmissionComment,
    MissionSubmissionLike,
    MissionSchedule,
    ScheduleMember,
    ScheduleMission,
)


OPEN_SESSION_STATUSES = ("WAITING", "READY", "SHOOTING", "UPLOADING", "REVEALED")
# A newly created session is also the current session for the schedule. This
# lets the client discover WAITING/READY sessions before the camera starts.
ACTIVE_MISSION_STATUSES = OPEN_SESSION_STATUSES
SESSION_DURATION = timedelta(minutes=30)
VOTING_DURATION = timedelta(minutes=10)


class ActiveMissionSessionConflict(Exception):
    def __init__(self, session: MissionSession):
        self.session = session
        super().__init__("Another mission is already active in this schedule.")


class MissionSessionExpired(Exception):
    pass


class VotingSessionExpired(Exception):
    pass


class SubmissionAlreadyExists(Exception):
    def __init__(self, submission: MissionSubmission):
        self.submission = submission
        super().__init__("This user has already submitted a photo for the mission session.")


class SubmissionCommentAlreadyExists(Exception):
    def __init__(self, comment: MissionSubmissionComment):
        self.comment = comment
        super().__init__("This user has already commented on this submission.")


class VotingNotReady(Exception):
    pass


def _load_session(db: Session, session_id: int) -> MissionSession | None:
    session = db.scalar(
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
            (MissionSession.expires_at.is_(None) | (MissionSession.expires_at > datetime.now(timezone.utc))),
        )
        .order_by(MissionSession.started_at.desc(), MissionSession.id.desc())
    )
    if excluded_schedule_mission_id is not None:
        stmt = stmt.where(MissionSession.schedule_mission_id != excluded_schedule_mission_id)
    return db.scalar(stmt)


def _ensure_session_not_expired(
    db: Session, session: MissionSession, *, allow_voting: bool = False
) -> None:
    # Repair sessions created by the old behavior where the creator's first
    # upload started voting before all accepted schedule participants joined.
    now = datetime.now(timezone.utc)
    if (
        session.status == "VOTING"
        and session.expires_at is not None
        and session.expires_at > now
        and len(session.members) < _expected_session_member_count(
            db, session.schedule_mission.schedule_id
        )
    ):
        session.status = "UPLOADING"
        session.voting_expires_at = None
        db.commit()
    allowed_statuses = OPEN_SESSION_STATUSES + (("VOTING",) if allow_voting else ())
    if session.status not in allowed_statuses:
        raise VotingSessionExpired("Mission execution is closed.")
    if session.expires_at is not None and session.expires_at <= now:
        _enter_commentary(session)
        db.commit()
        raise MissionSessionExpired("Mission session expired.")


def _enter_voting(db: Session, session: MissionSession) -> None:
    if session.status != "VOTING":
        session.status = "VOTING"
        session.voting_expires_at = datetime.now(timezone.utc) + VOTING_DURATION


def _enter_commentary(session: MissionSession) -> None:
    if session.status in ("SHOOTING", "UPLOADING"):
        session.status = "REVEALED"
        session.voting_expires_at = None


def _all_members_commented(db: Session, session: MissionSession) -> bool:
    member_count = len(session.members)
    submission_count = len(session.submissions)
    if member_count == 0 or submission_count == 0:
        return False
    comment_count = db.scalar(
        select(func.count(MissionSubmissionComment.id))
        .join(MissionSubmission, MissionSubmission.id == MissionSubmissionComment.submission_id)
        .where(MissionSubmission.session_id == session.id)
    )
    return comment_count == member_count * submission_count


def _maybe_start_voting(db: Session, session: MissionSession) -> bool:
    if session.status == "REVEALED" and _all_members_commented(db, session):
        _enter_voting(db, session)
        return True
    return False


def _finalize_voting_if_expired(db: Session, session: MissionSession) -> None:
    if session.status != "VOTING" or session.voting_expires_at is None:
        return
    if session.voting_expires_at > datetime.now(timezone.utc):
        return
    candidates = [item for item in session.submissions if item.like_count > 0]
    winner_submission = min(
        candidates,
        key=lambda item: (
            -item.like_count,
            max(like.created_at for like in item.likes),
            item.id,
        ),
        default=None,
    )
    session.winner_user_id = winner_submission.user_id if winner_submission else None
    session.status = "COMPLETED"
    session.schedule_mission.status = "COMPLETED"
    session.schedule_mission.winner_user_id = session.winner_user_id
    db.commit()


def _record_expiration(db: Session, session: MissionSession) -> None:
    if (
        session.status in ACTIVE_MISSION_STATUSES
        and session.expires_at is not None
        and session.expires_at <= datetime.now(timezone.utc)
    ):
        _enter_commentary(session)
        db.commit()


def _ensure_voting_open(db: Session, session: MissionSession) -> None:
    _finalize_voting_if_expired(db, session)
    if session.status != "VOTING":
        raise VotingSessionExpired("Voting is not open for this session.")


def _load_submission(db: Session, submission_id: int) -> MissionSubmission | None:
    return db.scalar(
        select(MissionSubmission)
        .where(MissionSubmission.id == submission_id)
        .options(
            selectinload(MissionSubmission.user),
            selectinload(MissionSubmission.likes),
            selectinload(MissionSubmission.comments).selectinload(MissionSubmissionComment.user),
        )
    )


def _expire_sessions_for_schedule(db: Session, schedule_id: int) -> None:
    now = datetime.now(timezone.utc)
    expired_sessions = db.scalars(
        select(MissionSession)
        .join(ScheduleMission, ScheduleMission.id == MissionSession.schedule_mission_id)
        .where(
            ScheduleMission.schedule_id == schedule_id,
            MissionSession.status.in_(ACTIVE_MISSION_STATUSES),
            MissionSession.expires_at <= now,
        )
    ).all()
    if expired_sessions:
        for session in expired_sessions:
            _enter_commentary(session)
        db.commit()


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


def _expected_session_member_count(db: Session, schedule_id: int) -> int:
    schedule = db.scalar(
        select(MissionSchedule)
        .where(MissionSchedule.id == schedule_id)
        .options(selectinload(MissionSchedule.members))
    )
    if schedule is None:
        return 0
    return 1 + sum(member.status == "ACCEPTED" for member in schedule.members)


def _refresh_session_progress_for_schedule(db: Session, schedule_id: int) -> None:
    sessions = db.scalars(
        select(MissionSession)
        .join(ScheduleMission, ScheduleMission.id == MissionSession.schedule_mission_id)
        .where(
            ScheduleMission.schedule_id == schedule_id,
            MissionSession.status.in_(("REVEALED", "VOTING")),
        )
    ).all()
    for session in sessions:
        loaded_session = _load_session(db, session.id)
        if loaded_session is None:
            continue
        _maybe_start_voting(db, loaded_session)
        _finalize_voting_if_expired(db, loaded_session)
    db.commit()


def _add_session_member(db: Session, session: MissionSession, user_id: int) -> bool:
    if any(member.user_id == user_id for member in session.members):
        return False
    session.members.append(MissionSessionMember(user_id=user_id))
    return True


def create_session(db: Session, schedule_id: int, schedule_mission_id: int, user_id: int):
    schedule_mission = _accessible_schedule_mission(db, schedule_id, user_id, schedule_mission_id)
    if schedule_mission is None:
        return None
    _refresh_session_progress_for_schedule(db, schedule_id)
    _expire_sessions_for_schedule(db, schedule_id)
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
            (MissionSession.expires_at.is_(None) | (MissionSession.expires_at > datetime.now(timezone.utc))),
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
                (MissionSession.expires_at.is_(None) | (MissionSession.expires_at > datetime.now(timezone.utc))),
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
    _refresh_session_progress_for_schedule(db, schedule_id)
    session = db.scalar(
        select(MissionSession)
        .where(MissionSession.schedule_mission_id == schedule_mission.id)
        .where(MissionSession.status.in_(OPEN_SESSION_STATUSES))
        .where(
            MissionSession.expires_at.is_(None)
            | (MissionSession.expires_at > datetime.now(timezone.utc))
        )
        .order_by(MissionSession.created_at.desc(), MissionSession.id.desc())
    )
    if session is None:
        session = db.scalar(
            select(MissionSession)
            .where(MissionSession.schedule_mission_id == schedule_mission.id)
            .order_by(MissionSession.created_at.desc(), MissionSession.id.desc())
        )
    if session is not None:
        _finalize_voting_if_expired(db, session)
        _record_expiration(db, session)
    return _load_session(db, session.id) if session is not None else None


def get_active_session_for_schedule(db: Session, schedule_id: int, user_id: int):
    schedule = db.scalar(
        select(MissionSchedule)
        .where(MissionSchedule.id == schedule_id)
        .options(selectinload(MissionSchedule.members))
    )
    if schedule is None or not _can_participate(schedule, user_id):
        return None
    _refresh_session_progress_for_schedule(db, schedule_id)
    session = _active_session_for_schedule(db, schedule_id)
    return _load_session(db, session.id) if session is not None else None


def get_session_for_user(db: Session, session_id: int, user_id: int):
    session = _load_session(db, session_id)
    if session is None:
        return None
    _finalize_voting_if_expired(db, session)
    _record_expiration(db, session)
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
    _ensure_session_not_expired(db, session)
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
    _ensure_session_not_expired(db, session)
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
    _ensure_session_not_expired(db, session)
    _ensure_mission_is_allowed(
        db, session.schedule_mission.schedule_id, session.schedule_mission_id
    )
    session.status = "SHOOTING"
    session.started_at = datetime.now(timezone.utc)
    session.expires_at = session.started_at + SESSION_DURATION
    db.commit()
    return _load_session(db, session_id)


def ensure_can_add_submission(db: Session, session_id: int, user_id: int) -> None:
    session = _load_session(db, session_id)
    if session is None or not any(member.user_id == user_id for member in session.members):
        return
    _ensure_session_not_expired(db, session)
    _ensure_mission_is_allowed(
        db, session.schedule_mission.schedule_id, session.schedule_mission_id
    )
    submission = db.scalar(select(MissionSubmission).where(
        MissionSubmission.session_id == session_id, MissionSubmission.user_id == user_id
    ))
    if submission is not None:
        raise SubmissionAlreadyExists(submission)


def add_submission(db: Session, session_id: int, user_id: int, storage_key: str, photo_url: str, captured_at):
    session = _load_session(db, session_id)
    if session is None or not any(member.user_id == user_id for member in session.members):
        return None
    _ensure_session_not_expired(db, session)
    _ensure_mission_is_allowed(
        db, session.schedule_mission.schedule_id, session.schedule_mission_id
    )
    submission = db.scalar(select(MissionSubmission).where(
        MissionSubmission.session_id == session_id, MissionSubmission.user_id == user_id
    ))
    if submission is not None:
        raise SubmissionAlreadyExists(submission)
    submission = MissionSubmission(session_id=session_id, user_id=user_id,
                                   storage_key=storage_key, photo_url=photo_url,
                                   captured_at=captured_at)
    db.add(submission)
    session.status = "UPLOADING"
    db.flush()
    member_count = len(session.members)
    submission_count = db.scalar(
        select(func.count(MissionSubmission.id)).where(MissionSubmission.session_id == session_id)
    )
    # A submission from the creator must not immediately start voting while
    # accepted schedule participants are still joining this shared session.
    expected_member_count = _expected_session_member_count(
        db, session.schedule_mission.schedule_id
    )
    if (
        member_count > 0
        and member_count >= expected_member_count
        and submission_count == member_count
    ):
        _enter_commentary(session)
    db.commit()
    return db.scalar(select(MissionSubmission).where(MissionSubmission.id == submission.id)
                     .options(selectinload(MissionSubmission.user)))


def reveal_session(db: Session, session_id: int, user_id: int):
    session = _load_session(db, session_id)
    if session is None or session.created_by_user_id != user_id:
        return None
    _ensure_session_not_expired(db, session)
    session.status = "REVEALED"
    session.revealed_at = datetime.now(timezone.utc)
    db.commit()
    return _load_session(db, session_id)


def complete_session(db: Session, session_id: int, user_id: int):
    session = _load_session(db, session_id)
    if session is None or session.created_by_user_id != user_id:
        return None
    _ensure_session_not_expired(db, session, allow_voting=True)
    if session.status == "VOTING":
        _finalize_voting_if_expired(db, session)
        if session.status == "VOTING":
            candidates = [item for item in session.submissions if item.like_count > 0]
            winner_submission = min(
                candidates,
                key=lambda item: (
                    -item.like_count,
                    max(like.created_at for like in item.likes),
                    item.id,
                ),
                default=None,
            )
            session.winner_user_id = winner_submission.user_id if winner_submission else None
    session.status = "COMPLETED"
    session.completed_at = datetime.now(timezone.utc)
    session.schedule_mission.status = "COMPLETED"
    session.schedule_mission.winner_user_id = session.winner_user_id
    db.commit()
    return _load_session(db, session_id)


def add_submission_comment(
    db: Session, session_id: int, submission_id: int, user_id: int, content: str
):
    session = _load_session(db, session_id)
    if session is None or not any(member.user_id == user_id for member in session.members):
        return None
    if session.status != "REVEALED":
        raise VotingNotReady("Comments are not open for this session.")
    submission = next((item for item in session.submissions if item.id == submission_id), None)
    if submission is None:
        return None
    comment = MissionSubmissionComment(
        submission_id=submission_id,
        user_id=user_id,
        content=content,
    )
    db.add(comment)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        existing = db.scalar(
            select(MissionSubmissionComment).where(
                MissionSubmissionComment.submission_id == submission_id,
                MissionSubmissionComment.user_id == user_id,
            )
        )
        if existing is not None:
            raise SubmissionCommentAlreadyExists(existing)
        raise
    _maybe_start_voting(db, session)
    db.commit()
    return db.scalar(
        select(MissionSubmissionComment)
        .where(MissionSubmissionComment.id == comment.id)
        .options(selectinload(MissionSubmissionComment.user))
    )


def like_submission(db: Session, session_id: int, submission_id: int, user_id: int):
    session = _load_session(db, session_id)
    if session is None or not any(member.user_id == user_id for member in session.members):
        return None, "not_found"
    _ensure_voting_open(db, session)
    submission = next((item for item in session.submissions if item.id == submission_id), None)
    if submission is None:
        return None, "not_found"
    if submission.user_id == user_id:
        return None, "self_like"
    existing = db.scalar(
        select(MissionSubmissionLike).where(
            MissionSubmissionLike.session_id == session_id,
            MissionSubmissionLike.user_id == user_id,
        )
    )
    if existing is None:
        db.add(
            MissionSubmissionLike(
                submission_id=submission_id,
                session_id=session_id,
                user_id=user_id,
            )
        )
        db.commit()
    return _load_submission(db, submission_id), None
