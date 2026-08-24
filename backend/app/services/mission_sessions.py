from datetime import datetime, timedelta, timezone
import math

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.config import get_settings
from app.models.missions import Mission, MissionDeveloperLocation, MissionLocation
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


OPEN_SESSION_STATUSES = (
    "WAITING",
    "READY",
    "SHOOTING",
    "UPLOADING",
    "REVEALED",
    "VOTING",
)
# A newly created session is also the current session for the schedule. This
# lets the client discover WAITING/READY sessions before the camera starts.
ACTIVE_MISSION_STATUSES = OPEN_SESSION_STATUSES
SESSION_DURATION = timedelta(minutes=30)
SHOOTING_DURATION = timedelta(seconds=60)
RETAKE_DURATION = timedelta(seconds=60)
VOTING_DURATION = timedelta(minutes=10)
TERMINAL_MEMBER_STATUSES = ("SKIPPED", "LOCKED_OUT", "TIMED_OUT", "COMPLETED")
EARTH_RADIUS_M = 6_371_008.8


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


class ParticipationLocked(Exception):
    pass


class ParticipationNotAllowed(Exception):
    pass


class MissionLocationValidationError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        *,
        distance_m: float | None = None,
        allowed_radius_m: int | None = None,
        accuracy_m: float | None = None,
        max_accuracy_m: float | None = None,
    ):
        self.code = code
        self.distance_m = distance_m
        self.allowed_radius_m = allowed_radius_m
        self.accuracy_m = accuracy_m
        self.max_accuracy_m = max_accuracy_m
        super().__init__(message)


class NoParticipants(Exception):
    pass


def _session_load_options():
    """Load a complete session response in three bounded SQL queries.

    The mission graph is small and belongs to the root row, while members and
    submissions are the two potentially growing collections. Keeping those as
    select-in loads avoids a members x submissions cartesian product, and
    joining their nested relationships prevents one query per response field.
    """
    return (
        joinedload(MissionSession.schedule_mission)
        .joinedload(ScheduleMission.mission)
        .joinedload(Mission.translations),
        joinedload(MissionSession.schedule_mission)
        .joinedload(ScheduleMission.mission)
        .joinedload(Mission.locations)
        .joinedload(MissionLocation.translations),
        selectinload(MissionSession.members).joinedload(MissionSessionMember.user),
        selectinload(MissionSession.submissions).joinedload(MissionSubmission.user),
        selectinload(MissionSession.submissions).joinedload(MissionSubmission.likes),
        selectinload(MissionSession.submissions)
        .joinedload(MissionSubmission.comments)
        .joinedload(MissionSubmissionComment.user),
    )


def _accepted_schedule_member_exists(user_id: int):
    return (
        select(ScheduleMember.id)
        .where(
            ScheduleMember.schedule_id == MissionSchedule.id,
            ScheduleMember.user_id == user_id,
            ScheduleMember.status == "ACCEPTED",
        )
        .exists()
    )


def _load_session_from_statement(db: Session, statement) -> MissionSession | None:
    result = db.execute(statement.options(*_session_load_options())).unique()
    return result.scalar_one_or_none()


def _load_session(
    db: Session,
    session_id: int,
    *,
    accessible_by_user_id: int | None = None,
) -> MissionSession | None:
    statement = select(MissionSession).where(MissionSession.id == session_id)
    if accessible_by_user_id is not None:
        statement = (
            statement.join(MissionSession.schedule_mission)
            .join(ScheduleMission.schedule)
            .where(
                or_(
                    MissionSchedule.creator_id == accessible_by_user_id,
                    _accepted_schedule_member_exists(accessible_by_user_id),
                )
            )
        )
    session = _load_session_from_statement(db, statement)
    if session is not None:
        # Keep the response stable for clients that render the creator/companion
        # uploads side by side, and make sure the complete session collection is
        # returned rather than whichever row happened to be loaded first.
        session.members.sort(key=lambda member: (member.joined_at, member.id))
        session.submissions.sort(key=lambda submission: (submission.uploaded_at, submission.id))
    return session


def _accessible_schedule_mission(db: Session, schedule_id: int, user_id: int, schedule_mission_id: int):
    accepted_member = (
        select(ScheduleMember.id)
        .where(
            ScheduleMember.schedule_id == schedule_id,
            ScheduleMember.user_id == user_id,
            ScheduleMember.status == "ACCEPTED",
        )
        .exists()
    )
    return db.scalar(
        select(ScheduleMission)
        .join(MissionSchedule, MissionSchedule.id == ScheduleMission.schedule_id)
        .where(
            ScheduleMission.id == schedule_mission_id,
            ScheduleMission.schedule_id == schedule_id,
            or_(MissionSchedule.creator_id == user_id, accepted_member),
        )
    )


def _can_participate(schedule: MissionSchedule, user_id: int) -> bool:
    return schedule.creator_id == user_id or any(
        member.user_id == user_id and member.status == "ACCEPTED"
        for member in schedule.members
    )


def can_access_schedule(db: Session, schedule_id: int, user_id: int) -> bool:
    accessible_schedule_id = db.scalar(
        select(MissionSchedule.id)
        .where(
            MissionSchedule.id == schedule_id,
            or_(
                MissionSchedule.creator_id == user_id,
                _accepted_schedule_member_exists(user_id),
            ),
        )
        .limit(1)
    )
    return accessible_schedule_id is not None


def _member(session: MissionSession, user_id: int) -> MissionSessionMember | None:
    return next((item for item in session.members if item.user_id == user_id), None)


def _distance_m(
    latitude_a: float,
    longitude_a: float,
    latitude_b: float,
    longitude_b: float,
) -> float:
    """Return the great-circle distance between two WGS84 coordinates."""
    lat_a = math.radians(latitude_a)
    lat_b = math.radians(latitude_b)
    delta_lat = lat_b - lat_a
    delta_lon = math.radians(longitude_b - longitude_a)
    haversine = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat_a) * math.cos(lat_b) * math.sin(delta_lon / 2) ** 2
    )
    haversine = min(1.0, max(0.0, haversine))
    return EARTH_RADIUS_M * 2 * math.atan2(
        math.sqrt(haversine), math.sqrt(1 - haversine)
    )


def _active_developer_locations(db: Session) -> list[MissionDeveloperLocation]:
    return list(
        db.scalars(
            select(MissionDeveloperLocation)
            .where(MissionDeveloperLocation.is_active.is_(True))
            .order_by(MissionDeveloperLocation.id)
        ).all()
    )


def _clear_member_location(member: MissionSessionMember, status: str) -> None:
    member.location_check_status = status
    member.location_id = None
    member.location_latitude = None
    member.location_longitude = None
    member.location_accuracy_m = None
    member.location_distance_m = None
    member.location_measured_at = None
    member.location_checked_at = None


def _record_location_attempt(
    member: MissionSessionMember,
    *,
    status: str,
    checked_at: datetime,
    latitude: float | None,
    longitude: float | None,
    accuracy_m: float | None,
    measured_at: datetime | None,
    location_id: int | None = None,
    distance_m: float | None = None,
) -> None:
    member.location_check_status = status
    member.location_id = location_id
    member.location_latitude = latitude
    member.location_longitude = longitude
    member.location_accuracy_m = accuracy_m
    member.location_distance_m = distance_m
    member.location_measured_at = measured_at
    member.location_checked_at = checked_at


def _fail_location_check(
    db: Session,
    member: MissionSessionMember,
    error: MissionLocationValidationError,
    *,
    checked_at: datetime,
    latitude: float | None,
    longitude: float | None,
    accuracy_m: float | None,
    measured_at: datetime | None,
    location_id: int | None = None,
) -> None:
    member.participation_status = "UNDECIDED"
    member.decision_at = None
    member.ready_at = None
    member.excluded_at = None
    member.exclusion_reason = None
    member.upload_deadline_at = None
    _record_location_attempt(
        member,
        status="FAILED",
        checked_at=checked_at,
        latitude=latitude,
        longitude=longitude,
        accuracy_m=accuracy_m,
        measured_at=measured_at,
        location_id=location_id,
        distance_m=error.distance_m,
    )
    db.commit()
    raise error


def _check_participation_location(
    db: Session,
    session: MissionSession,
    member: MissionSessionMember,
    *,
    latitude: float | None,
    longitude: float | None,
    accuracy_m: float | None,
    measured_at: datetime | None,
) -> None:
    mission = session.schedule_mission.mission
    if mission.verification_type != "GPS_PHOTO":
        _clear_member_location(member, "NOT_REQUIRED")
        return

    locations = [(location, False) for location in mission.locations]
    locations.extend(
        (location, True) for location in _active_developer_locations(db)
    )
    if not locations:
        _clear_member_location(member, "NOT_CONFIGURED")
        return

    now = datetime.now(timezone.utc)
    if None in (latitude, longitude, accuracy_m, measured_at):
        _fail_location_check(
            db,
            member,
            MissionLocationValidationError(
                "MISSION_LOCATION_REQUIRED",
                "Current location is required to participate in this mission.",
            ),
            checked_at=now,
            latitude=latitude,
            longitude=longitude,
            accuracy_m=accuracy_m,
            measured_at=measured_at,
        )

    assert latitude is not None
    assert longitude is not None
    assert accuracy_m is not None
    assert measured_at is not None
    if measured_at.tzinfo is None or measured_at.utcoffset() is None:
        _fail_location_check(
            db,
            member,
            MissionLocationValidationError(
                "MISSION_LOCATION_TIMESTAMP_INVALID",
                "Location measured_at must include a timezone offset.",
            ),
            checked_at=now,
            latitude=latitude,
            longitude=longitude,
            accuracy_m=accuracy_m,
            measured_at=measured_at,
        )

    settings = get_settings()
    measured_at = measured_at.astimezone(timezone.utc)
    age_seconds = (now - measured_at).total_seconds()
    if (
        age_seconds > settings.mission_location_max_age_seconds
        or age_seconds < -settings.mission_location_future_tolerance_seconds
    ):
        _fail_location_check(
            db,
            member,
            MissionLocationValidationError(
                "MISSION_LOCATION_STALE",
                "Measure the current location again before participating.",
            ),
            checked_at=now,
            latitude=latitude,
            longitude=longitude,
            accuracy_m=accuracy_m,
            measured_at=measured_at,
        )
    if accuracy_m > settings.mission_location_max_accuracy_m:
        _fail_location_check(
            db,
            member,
            MissionLocationValidationError(
                "MISSION_LOCATION_INACCURATE",
                "Location accuracy is too low. Move outdoors and try again.",
                accuracy_m=accuracy_m,
                max_accuracy_m=settings.mission_location_max_accuracy_m,
            ),
            checked_at=now,
            latitude=latitude,
            longitude=longitude,
            accuracy_m=accuracy_m,
            measured_at=measured_at,
        )

    distances = [
        (
            _distance_m(latitude, longitude, target.latitude, target.longitude),
            target,
            is_developer_location,
        )
        for target, is_developer_location in locations
    ]
    matching_locations = [
        item for item in distances if item[0] <= item[1].allowed_radius_m
    ]
    distance, nearest, nearest_is_developer_location = min(
        matching_locations or distances,
        key=lambda item: item[0],
    )
    matched_location_id = None if nearest_is_developer_location else nearest.id
    if not matching_locations:
        error = MissionLocationValidationError(
            "MISSION_LOCATION_OUT_OF_RANGE",
            "You are too far from the mission location.",
            distance_m=round(distance, 1),
            allowed_radius_m=nearest.allowed_radius_m,
            accuracy_m=accuracy_m,
            max_accuracy_m=settings.mission_location_max_accuracy_m,
        )
        _fail_location_check(
            db,
            member,
            error,
            checked_at=now,
            latitude=latitude,
            longitude=longitude,
            accuracy_m=accuracy_m,
            measured_at=measured_at,
            location_id=matched_location_id,
        )

    _record_location_attempt(
        member,
        status="PASSED",
        checked_at=now,
        latitude=latitude,
        longitude=longitude,
        accuracy_m=accuracy_m,
        measured_at=measured_at,
        location_id=matched_location_id,
        distance_m=round(distance, 1),
    )


def _completed_user_ids(session: MissionSession) -> set[int]:
    return {
        member.user_id
        for member in session.members
        if member.participation_status == "COMPLETED"
    }


def _eligible_submissions(session: MissionSession) -> list[MissionSubmission]:
    completed_user_ids = _completed_user_ids(session)
    return [
        item
        for item in session.submissions
        if item.user_id in completed_user_ids and item.judge_status == "PASSED"
    ]


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


def _ensure_session_not_expired(
    db: Session, session: MissionSession, *, allow_voting: bool = False
) -> None:
    now = datetime.now(timezone.utc)
    allowed_statuses = OPEN_SESSION_STATUSES + (("VOTING",) if allow_voting else ())
    if session.status not in allowed_statuses:
        raise VotingSessionExpired("Mission execution is closed.")
    if (
        session.status != "VOTING"
        and session.expires_at is not None
        and session.expires_at <= now
    ):
        _expire_late_participants(session, now, force=True)
        _maybe_finish_shooting(session)
        db.commit()
        raise MissionSessionExpired("Mission session expired.")


def _enter_voting(db: Session, session: MissionSession) -> None:
    if session.status != "VOTING":
        session.status = "VOTING"
        session.voting_expires_at = datetime.now(timezone.utc) + VOTING_DURATION


def _enter_commentary(session: MissionSession) -> None:
    if session.status in ("SHOOTING", "UPLOADING"):
        session.status = "REVEALED"
        session.revealed_at = datetime.now(timezone.utc)
        session.voting_expires_at = None


def _expire_late_participants(
    session: MissionSession, now: datetime, *, force: bool = False
) -> bool:
    if session.status not in ("SHOOTING", "UPLOADING"):
        return False
    submissions_by_user = {item.user_id: item for item in session.submissions}
    changed = False
    for member in session.members:
        if member.participation_status != "PARTICIPATING":
            continue
        deadline = member.upload_deadline_at or session.shooting_deadline_at
        if not force and (deadline is None or deadline > now):
            continue
        submission = submissions_by_user.get(member.user_id)
        if (
            submission is not None
            and submission.judge_status in ("PENDING", "PROCESSING")
            and not force
        ):
            continue
        if submission is not None and submission.judge_status == "PASSED":
            member.participation_status = "COMPLETED"
            member.upload_deadline_at = None
        else:
            member.participation_status = "TIMED_OUT"
            member.excluded_at = now
            member.exclusion_reason = "PHOTO_TIMEOUT"
            member.upload_deadline_at = None
        changed = True
    return changed


def _maybe_finish_shooting(session: MissionSession) -> bool:
    if session.status not in ("SHOOTING", "UPLOADING"):
        return False
    if any(
        member.participation_status not in TERMINAL_MEMBER_STATUSES
        for member in session.members
    ):
        return False
    completed_members = [
        member for member in session.members if member.participation_status == "COMPLETED"
    ]
    if not completed_members:
        session.status = "CANCELLED"
        session.completed_at = datetime.now(timezone.utc)
        return True
    if len(completed_members) == 1:
        session.winner_user_id = completed_members[0].user_id
        session.status = "COMPLETED"
        session.completed_at = datetime.now(timezone.utc)
        session.schedule_mission.status = "COMPLETED"
        session.schedule_mission.winner_user_id = session.winner_user_id
        return True
    _enter_commentary(session)
    return True


def apply_judgement_to_participant(
    submission: MissionSubmission, judgement_status: str
) -> datetime | None:
    session = submission.session
    member = _member(session, submission.user_id)
    if member is None or member.participation_status != "PARTICIPATING":
        return None
    if judgement_status == "PASSED":
        member.participation_status = "COMPLETED"
        member.upload_deadline_at = None
        _maybe_finish_shooting(session)
        return None
    deadline = datetime.now(timezone.utc) + RETAKE_DURATION
    member.upload_deadline_at = deadline
    member.exclusion_reason = None
    return deadline


def expire_session_participants(db: Session, session_id: int) -> MissionSession | None:
    session = _load_session(db, session_id)
    if session is None:
        return None
    changed = _expire_late_participants(session, datetime.now(timezone.utc))
    if changed:
        _maybe_finish_shooting(session)
        db.commit()
    return _load_session(db, session_id)


def _all_members_commented(db: Session, session: MissionSession) -> bool:
    completed_user_ids = _completed_user_ids(session)
    member_count = len(completed_user_ids)
    eligible_submissions = _eligible_submissions(session)
    submission_count = len(eligible_submissions)
    if member_count == 0 or submission_count == 0:
        return False
    submission_ids = [item.id for item in eligible_submissions]
    comment_count = db.scalar(
        select(func.count(MissionSubmissionComment.id))
        .join(MissionSubmission, MissionSubmission.id == MissionSubmissionComment.submission_id)
        .where(
            MissionSubmissionComment.submission_id.in_(submission_ids),
            MissionSubmissionComment.user_id.in_(completed_user_ids),
        )
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
    _finish_voting(session)
    db.commit()


def _finish_voting(session: MissionSession) -> None:
    candidates = [item for item in _eligible_submissions(session) if item.like_count > 0]
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


def _maybe_finish_voting_when_all_voted(session: MissionSession) -> bool:
    if session.status != "VOTING":
        return False
    voter_ids = _completed_user_ids(session)
    voted_user_ids = {
        like.user_id
        for submission in _eligible_submissions(session)
        for like in submission.likes
        if like.user_id in voter_ids
    }
    if voter_ids and voted_user_ids == voter_ids:
        _finish_voting(session)
        return True
    return False


def finalize_voting_session(db: Session, session_id: int) -> MissionSession | None:
    session = _load_session(db, session_id)
    if session is None:
        return None
    _finalize_voting_if_expired(db, session)
    return _load_session(db, session_id)


def _record_expiration(db: Session, session: MissionSession) -> None:
    changed = _expire_late_participants(session, datetime.now(timezone.utc))
    if changed:
        _maybe_finish_shooting(session)
        db.commit()
    if (
        session.status in ACTIVE_MISSION_STATUSES
        and session.expires_at is not None
        and session.expires_at <= datetime.now(timezone.utc)
    ):
        _expire_late_participants(session, datetime.now(timezone.utc), force=True)
        _maybe_finish_shooting(session)
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
            MissionSession.status != "VOTING",
            MissionSession.expires_at <= now,
        )
    ).all()
    if expired_sessions:
        for session in expired_sessions:
            loaded = _load_session(db, session.id)
            if loaded is not None:
                _expire_late_participants(loaded, now, force=True)
                _maybe_finish_shooting(loaded)
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


def _schedule_participant_ids(db: Session, schedule_id: int) -> list[int]:
    schedule = db.scalar(
        select(MissionSchedule)
        .where(MissionSchedule.id == schedule_id)
        .options(selectinload(MissionSchedule.members))
    )
    if schedule is None:
        return []
    return [
        schedule.creator_id,
        *[
            member.user_id
            for member in schedule.members
            if member.status == "ACCEPTED"
        ],
    ]


def _refresh_loaded_session_progress(db: Session, session: MissionSession) -> bool:
    now = datetime.now(timezone.utc)
    changed = _expire_late_participants(session, now)
    changed = _maybe_finish_shooting(session) or changed
    changed = _maybe_start_voting(db, session) or changed
    if (
        session.status == "VOTING"
        and session.voting_expires_at is not None
        and session.voting_expires_at <= now
    ):
        _finish_voting(session)
        changed = True
    if changed:
        db.commit()
    return changed


def _refresh_session_progress(db: Session, session_id: int) -> MissionSession | None:
    session = _load_session(db, session_id)
    if session is None:
        return None
    changed = _refresh_loaded_session_progress(db, session)
    return _load_session(db, session_id) if changed else session


def _refresh_session_progress_for_schedule(db: Session, schedule_id: int) -> None:
    session_ids = db.scalars(
        select(MissionSession.id)
        .join(ScheduleMission, ScheduleMission.id == MissionSession.schedule_mission_id)
        .where(
            ScheduleMission.schedule_id == schedule_id,
            MissionSession.status.in_(("SHOOTING", "UPLOADING", "REVEALED", "VOTING")),
        )
    ).all()
    for session_id in session_ids:
        _refresh_session_progress(db, session_id)


def _add_session_member(
    db: Session,
    session: MissionSession,
    user_id: int,
    participation_status: str = "UNDECIDED",
) -> bool:
    if any(member.user_id == user_id for member in session.members):
        return False
    session.members.append(
        MissionSessionMember(
            user_id=user_id,
            participation_status=participation_status,
        )
    )
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
        )
        .order_by(MissionSession.created_at.desc(), MissionSession.id.desc())
    )
    if existing is not None:
        changed = False
        if existing.participants_locked_at is None:
            for participant_id in _schedule_participant_ids(db, schedule_id):
                changed = _add_session_member(db, existing, participant_id) or changed
        if changed:
            db.commit()
        return _load_session(db, existing.id)
    session = MissionSession(
        schedule_mission_id=schedule_mission.id,
        created_by_user_id=user_id,
        status="WAITING",
    )
    db.add(session)
    db.flush()
    for participant_id in _schedule_participant_ids(db, schedule_id):
        _add_session_member(db, session, participant_id)
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
    session = _load_session_from_statement(
        db,
        select(MissionSession)
        .join(MissionSession.schedule_mission)
        .join(ScheduleMission.schedule)
        .where(
            ScheduleMission.id == schedule_mission_id,
            ScheduleMission.schedule_id == schedule_id,
            or_(
                MissionSchedule.creator_id == user_id,
                _accepted_schedule_member_exists(user_id),
            ),
        )
        .order_by(
            MissionSession.status.in_(OPEN_SESSION_STATUSES).desc(),
            MissionSession.created_at.desc(),
            MissionSession.id.desc(),
        )
        .limit(1),
    )
    if session is None:
        return None
    changed = _refresh_loaded_session_progress(db, session)
    return _load_session(db, session.id) if changed else session


def get_active_session_for_schedule(db: Session, schedule_id: int, user_id: int):
    session = _load_session_from_statement(
        db,
        select(MissionSession)
        .join(MissionSession.schedule_mission)
        .join(ScheduleMission.schedule)
        .where(
            ScheduleMission.schedule_id == schedule_id,
            MissionSession.status.in_(ACTIVE_MISSION_STATUSES),
            or_(
                MissionSchedule.creator_id == user_id,
                _accepted_schedule_member_exists(user_id),
            ),
        )
        .order_by(MissionSession.started_at.desc(), MissionSession.id.desc())
        .limit(1),
    )
    if session is None:
        return None
    changed = _refresh_loaded_session_progress(db, session)
    refreshed = _load_session(db, session.id) if changed else session
    if refreshed.status not in ACTIVE_MISSION_STATUSES:
        return None
    return refreshed


def get_session_for_user(db: Session, session_id: int, user_id: int):
    session = _load_session(
        db,
        session_id,
        accessible_by_user_id=user_id,
    )
    if session is None:
        return None
    _finalize_voting_if_expired(db, session)
    _record_expiration(db, session)
    return session


def join_session(db: Session, session_id: int, user_id: int):
    # Compatibility endpoint: the old join action now means "participate".
    session = _load_session(db, session_id)
    member = _member(session, user_id) if session is not None else None
    if member is not None and member.participation_status == "PARTICIPATING":
        return session
    return set_participation(db, session_id, user_id, "PARTICIPATE")


def set_participation(
    db: Session,
    session_id: int,
    user_id: int,
    decision: str,
    *,
    latitude: float | None = None,
    longitude: float | None = None,
    accuracy_m: float | None = None,
    measured_at: datetime | None = None,
):
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
    if session.participants_locked_at is not None or session.status not in ("WAITING", "READY"):
        raise ParticipationLocked("Participation choices are already locked.")
    member = _member(session, user_id)
    if member is None:
        _add_session_member(db, session, user_id)
        member = _member(session, user_id)
    now = datetime.now(timezone.utc)
    if decision == "PARTICIPATE":
        _check_participation_location(
            db,
            session,
            member,
            latitude=latitude,
            longitude=longitude,
            accuracy_m=accuracy_m,
            measured_at=measured_at,
        )
    else:
        _clear_member_location(member, "NOT_REQUIRED")
    member.decision_at = now
    member.ready_at = now if decision == "PARTICIPATE" else None
    member.upload_deadline_at = None
    if decision == "PARTICIPATE":
        member.participation_status = "PARTICIPATING"
        member.excluded_at = None
        member.exclusion_reason = None
    else:
        member.participation_status = "SKIPPED"
        member.excluded_at = now
        member.exclusion_reason = "USER_SKIPPED"
    db.commit()
    return _load_session(db, session_id)


def mark_ready(db: Session, session_id: int, user_id: int):
    # Compatibility endpoint: there is no separate personal-ready phase now.
    session = _load_session(db, session_id)
    member = _member(session, user_id) if session is not None else None
    if member is not None and member.participation_status == "PARTICIPATING":
        return session
    return set_participation(db, session_id, user_id, "PARTICIPATE")


def start_session(db: Session, session_id: int, user_id: int):
    session = _load_session(db, session_id)
    if session is None or session.created_by_user_id != user_id:
        return None
    _ensure_session_not_expired(db, session)
    _ensure_mission_is_allowed(
        db, session.schedule_mission.schedule_id, session.schedule_mission_id
    )
    if session.participants_locked_at is not None:
        if session.status in ("SHOOTING", "UPLOADING"):
            return session
        raise ParticipationLocked("This mission session has already started.")
    participants = [
        member
        for member in session.members
        if member.participation_status == "PARTICIPATING"
    ]
    if not participants:
        raise NoParticipants("At least one participant must choose participate.")
    now = datetime.now(timezone.utc)
    shooting_deadline = now + SHOOTING_DURATION
    for member in session.members:
        if member.participation_status == "UNDECIDED":
            member.participation_status = "LOCKED_OUT"
            member.excluded_at = now
            member.exclusion_reason = "NO_DECISION"
        elif member.participation_status == "PARTICIPATING":
            member.upload_deadline_at = shooting_deadline
    session.status = "SHOOTING"
    session.participants_locked_at = now
    session.started_at = now
    session.shooting_deadline_at = shooting_deadline
    session.expires_at = now + SESSION_DURATION
    db.commit()
    return _load_session(db, session_id)


def ensure_can_add_submission(db: Session, session_id: int, user_id: int) -> bool:
    session = _load_session(db, session_id)
    if session is None:
        return False
    _ensure_session_not_expired(db, session)
    _expire_late_participants(session, datetime.now(timezone.utc))
    _maybe_finish_shooting(session)
    member = _member(session, user_id)
    if (
        member is None
        or member.participation_status != "PARTICIPATING"
        or session.status not in ("SHOOTING", "UPLOADING")
    ):
        db.commit()
        raise ParticipationNotAllowed(
            "Only a locked-in participant may upload during the shooting phase."
        )
    deadline = member.upload_deadline_at or session.shooting_deadline_at
    if deadline is not None and deadline <= datetime.now(timezone.utc):
        member.participation_status = "TIMED_OUT"
        member.excluded_at = datetime.now(timezone.utc)
        member.exclusion_reason = "PHOTO_TIMEOUT"
        member.upload_deadline_at = None
        _maybe_finish_shooting(session)
        db.commit()
        raise ParticipationNotAllowed("Your photo upload window has ended.")
    _ensure_mission_is_allowed(
        db, session.schedule_mission.schedule_id, session.schedule_mission_id
    )
    submission = db.scalar(select(MissionSubmission).where(
        MissionSubmission.session_id == session_id, MissionSubmission.user_id == user_id
    ))
    if submission is not None and submission.judge_status not in ("REJECTED", "ERROR"):
        raise SubmissionAlreadyExists(submission)
    return True


def add_submission(db: Session, session_id: int, user_id: int, storage_key: str, photo_url: str, captured_at):
    session = _load_session(db, session_id)
    if session is None:
        return None
    _ensure_session_not_expired(db, session)
    member = _member(session, user_id)
    if (
        member is None
        or member.participation_status != "PARTICIPATING"
        or session.status not in ("SHOOTING", "UPLOADING")
    ):
        raise ParticipationNotAllowed(
            "Only a locked-in participant may upload during the shooting phase."
        )
    _ensure_mission_is_allowed(
        db, session.schedule_mission.schedule_id, session.schedule_mission_id
    )
    submission = db.scalar(select(MissionSubmission).where(
        MissionSubmission.session_id == session_id, MissionSubmission.user_id == user_id
    ))
    if submission is None:
        submission = MissionSubmission(session_id=session_id, user_id=user_id)
        db.add(submission)
    submission.storage_key = storage_key
    submission.photo_url = photo_url
    submission.captured_at = captured_at
    submission.judge_status = "PENDING"
    submission.similarity_score = None
    submission.judge_reason = None
    submission.judge_model = None
    submission.judged_at = None
    submission.judge_error = None
    member.upload_deadline_at = None
    session.status = "UPLOADING"
    db.flush()
    db.commit()
    return db.scalar(select(MissionSubmission).where(MissionSubmission.id == submission.id)
                     .options(selectinload(MissionSubmission.user)))


def reveal_session(db: Session, session_id: int, user_id: int):
    session = _load_session(db, session_id)
    if session is None or session.created_by_user_id != user_id:
        return None
    _record_expiration(db, session)
    if session.status not in ("REVEALED", "VOTING", "COMPLETED"):
        raise VotingNotReady("Commentary opens automatically after shooting finishes.")
    return _load_session(db, session_id)


def complete_session(db: Session, session_id: int, user_id: int):
    session = _load_session(db, session_id)
    if session is None or session.created_by_user_id != user_id:
        return None
    _ensure_session_not_expired(db, session, allow_voting=True)
    if session.status == "VOTING":
        _finalize_voting_if_expired(db, session)
        if session.status == "VOTING":
            candidates = [item for item in _eligible_submissions(session) if item.like_count > 0]
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
    if session is None or user_id not in _completed_user_ids(session):
        return None
    if session.status != "REVEALED":
        raise VotingNotReady("Comments are not open for this session.")
    submission = next(
        (item for item in _eligible_submissions(session) if item.id == submission_id), None
    )
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
    if session is None or user_id not in _completed_user_ids(session):
        return None, "not_found"
    _ensure_voting_open(db, session)
    submission = next(
        (item for item in _eligible_submissions(session) if item.id == submission_id), None
    )
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
        refreshed_session = _load_session(db, session_id)
        if refreshed_session is not None and _maybe_finish_voting_when_all_voted(
            refreshed_session
        ):
            db.commit()
    return _load_submission(db, submission_id), None
