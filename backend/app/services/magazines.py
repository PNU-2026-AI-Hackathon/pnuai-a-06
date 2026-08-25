from collections import Counter
from datetime import date, datetime, timezone
import hashlib
import json

from sqlalchemy import select, text
from sqlalchemy.orm import Session, selectinload

from app.models.schedules import (
    MissionSchedule,
    MissionSession,
    MissionSessionMember,
    MissionSubmission,
    MissionSubmissionComment,
    ScheduleMember,
    ScheduleMission,
)
from app.models.magazines import ScheduleMagazine
from app.models.missions import Mission, MissionLocation
from app.schemas.magazines import (
    MagazineCommentResponse,
    MagazineCoverResponse,
    MagazineMissionResponse,
    MagazinePageResponse,
    MagazinePhotoResponse,
    MagazineSummaryResponse,
    MagazineWinnerCountResponse,
    ScheduleMagazineResponse,
)
from app.services.magazine_renderer import MagazineRenderError, MagazineTemplate, render_magazine
from app.services.localization import localized_mission


class MagazineSelectionRequired(ValueError):
    def __init__(self, *, max_selectable: int, candidate_ids: list[int]):
        self.max_selectable = max_selectable
        self.candidate_ids = candidate_ids
        super().__init__("Select missions before generating this magazine.")


class InvalidMagazineSelection(ValueError):
    pass


def _select_magazine_pages(
    renderable_pages: list[dict],
    *,
    schedule_mission_ids: list[int] | None,
    capacity: int,
) -> list[dict]:
    candidate_by_id = {
        page["schedule_mission_id"]: page for page in renderable_pages
    }
    if schedule_mission_ids is None:
        if len(renderable_pages) > capacity:
            raise MagazineSelectionRequired(
                max_selectable=capacity,
                candidate_ids=list(candidate_by_id),
            )
        return renderable_pages

    if len(schedule_mission_ids) > capacity:
        raise InvalidMagazineSelection(
            f"Select at most {capacity} missions for this frame."
        )
    invalid_ids = [item for item in schedule_mission_ids if item not in candidate_by_id]
    if invalid_ids:
        raise InvalidMagazineSelection(
            f"These schedule missions cannot be rendered: {invalid_ids}"
        )
    return [candidate_by_id[item] for item in schedule_mission_ids]
from app.schemas.schedules import ScheduleUserResponse


def _load_accessible_schedule(
    db: Session, schedule_id: int, user_id: int
) -> MissionSchedule | None:
    schedule = db.scalar(
        select(MissionSchedule)
        .where(MissionSchedule.id == schedule_id)
        .options(
            selectinload(MissionSchedule.creator),
            selectinload(MissionSchedule.members).selectinload(ScheduleMember.user),
        )
    )
    if schedule is None:
        return None
    if schedule.creator_id == user_id:
        return schedule
    if any(
        member.user_id == user_id and member.status == "ACCEPTED"
        for member in schedule.members
    ):
        return schedule
    return None


def _load_completed_sessions(db: Session, schedule_id: int) -> list[MissionSession]:
    sessions = db.scalars(
        select(MissionSession)
        .join(ScheduleMission, ScheduleMission.id == MissionSession.schedule_mission_id)
        .where(
            ScheduleMission.schedule_id == schedule_id,
            MissionSession.status == "COMPLETED",
        )
        .options(
            selectinload(MissionSession.schedule_mission).selectinload(
                ScheduleMission.mission
            ),
            selectinload(MissionSession.schedule_mission)
            .selectinload(ScheduleMission.mission)
            .selectinload(Mission.translations),
            selectinload(MissionSession.schedule_mission)
            .selectinload(ScheduleMission.mission)
            .selectinload(Mission.locations)
            .selectinload(MissionLocation.translations),
            selectinload(MissionSession.winner),
            selectinload(MissionSession.members).selectinload(MissionSessionMember.user),
            selectinload(MissionSession.submissions).selectinload(MissionSubmission.user),
            selectinload(MissionSession.submissions).selectinload(MissionSubmission.likes),
            selectinload(MissionSession.submissions)
            .selectinload(MissionSubmission.comments)
            .selectinload(MissionSubmissionComment.user),
        )
        .order_by(MissionSession.completed_at.desc(), MissionSession.id.desc())
    ).all()

    # A cancelled attempt can be retried. If legacy data contains more than one
    # completed session for one scheduled mission, expose only the latest result.
    latest_by_schedule_mission: dict[int, MissionSession] = {}
    for session in sessions:
        latest_by_schedule_mission.setdefault(session.schedule_mission_id, session)
    return sorted(
        latest_by_schedule_mission.values(),
        key=lambda session: (
            session.schedule_mission.planned_date is None,
            session.schedule_mission.planned_date or date.max,
            session.completed_at or session.created_at,
            session.id,
        ),
    )


def _user_response(user) -> ScheduleUserResponse:
    return ScheduleUserResponse.model_validate(user)


def _comment_response(comment: MissionSubmissionComment) -> MagazineCommentResponse:
    return MagazineCommentResponse(
        id=comment.id,
        user_id=comment.user_id,
        content=comment.content,
        created_at=comment.created_at,
        user=_user_response(comment.user),
    )


def _eligible_submissions(session: MissionSession) -> list[MissionSubmission]:
    completed_user_ids = {
        member.user_id
        for member in session.members
        if member.participation_status == "COMPLETED"
    }
    submissions = [
        submission
        for submission in session.submissions
        if submission.user_id in completed_user_ids
        and submission.judge_status == "PASSED"
    ]
    return sorted(
        submissions,
        key=lambda submission: (
            submission.user_id != session.winner_user_id,
            submission.uploaded_at,
            submission.id,
        ),
    )


def _photo_response(
    submission: MissionSubmission, winner_user_id: int | None
) -> MagazinePhotoResponse:
    comments = sorted(
        submission.comments,
        key=lambda comment: (comment.created_at, comment.id),
    )
    return MagazinePhotoResponse(
        submission_id=submission.id,
        user_id=submission.user_id,
        photo_url=submission.photo_url,
        captured_at=submission.captured_at,
        uploaded_at=submission.uploaded_at,
        like_count=submission.like_count,
        is_winner=submission.user_id == winner_user_id,
        user=_user_response(submission.user),
        comments=[_comment_response(comment) for comment in comments],
    )


def build_schedule_magazine(
    db: Session, *, schedule_id: int, user_id: int, locale: str = "ko"
) -> ScheduleMagazineResponse | None:
    schedule = _load_accessible_schedule(db, schedule_id, user_id)
    if schedule is None:
        return None

    participants = [
        schedule.creator,
        *[
            member.user
            for member in sorted(schedule.members, key=lambda item: (item.created_at, item.id))
            if member.status == "ACCEPTED"
        ],
    ]
    sessions = _load_completed_sessions(db, schedule_id)
    pages: list[MagazinePageResponse] = []
    winner_counts: Counter[int] = Counter()
    winner_users = {}
    visited_places: list[str] = []

    for page_index, session in enumerate(sessions):
        schedule_mission = session.schedule_mission
        mission = schedule_mission.mission
        mission_response = localized_mission(mission, locale)
        submissions = _eligible_submissions(session)
        photos = [
            _photo_response(submission, session.winner_user_id)
            for submission in submissions
        ]
        winner = session.winner
        winner_submission = next(
            (
                submission
                for submission in submissions
                if submission.user_id == session.winner_user_id
            ),
            None,
        )
        winner_comments = (
            sorted(
                winner_submission.comments,
                key=lambda comment: (comment.created_at, comment.id),
            )
            if winner_submission is not None
            else []
        )
        featured_comment = (
            _comment_response(winner_comments[0]) if winner_comments else None
        )

        if (
            mission_response.place_label
            and mission_response.place_label not in visited_places
        ):
            visited_places.append(mission_response.place_label)
        if winner is not None:
            winner_counts[winner.id] += 1
            winner_users[winner.id] = winner

        pages.append(
            MagazinePageResponse(
                page_index=page_index,
                schedule_mission_id=schedule_mission.id,
                session_id=session.id,
                planned_date=schedule_mission.planned_date,
                mission=MagazineMissionResponse(
                    code=mission.code,
                    title=mission_response.title,
                    description=mission_response.description,
                    emoji_url=mission.emoji_url,
                    district_code=mission.district_code,
                    district_label=mission_response.district_label,
                    place_label=mission_response.place_label,
                ),
                winner_user_id=session.winner_user_id,
                winner=_user_response(winner) if winner is not None else None,
                headline=mission_response.title,
                featured_comment=featured_comment,
                photos=photos,
            )
        )

    cover_photo_url = next(
        (
            photo.photo_url
            for page in pages
            for photo in page.photos
            if photo.is_winner
        ),
        pages[0].photos[0].photo_url if pages and pages[0].photos else None,
    )
    return ScheduleMagazineResponse(
        locale=locale,
        schedule_id=schedule.id,
        title=schedule.title,
        start_date=schedule.start_date,
        end_date=schedule.end_date,
        assembled_at=datetime.now(timezone.utc),
        participants=[_user_response(user) for user in participants],
        cover=MagazineCoverResponse(
            title=schedule.title,
            subtitle=f"{schedule.start_date.isoformat()} ~ {schedule.end_date.isoformat()}",
            photo_url=cover_photo_url,
        ),
        pages=pages,
        summary=MagazineSummaryResponse(
            completed_mission_count=len(pages),
            total_photo_count=sum(len(page.photos) for page in pages),
            visited_places=visited_places,
            winner_counts=[
                MagazineWinnerCountResponse(
                    user_id=winner_id,
                    win_count=win_count,
                    user=_user_response(winner_users[winner_id]),
                )
                for winner_id, win_count in sorted(
                    winner_counts.items(), key=lambda item: (-item[1], item[0])
                )
            ],
        ),
    )


def get_generated_magazine(
    db: Session,
    *,
    schedule_id: int,
    user_id: int,
    template_key: str,
    locale: str = "ko",
) -> ScheduleMagazine | None:
    # A generated magazine is shared across app languages. ``locale`` remains
    # in the call signature for compatibility, but it is not part of the
    # lookup identity; the returned record reports its generation language.
    if _load_accessible_schedule(db, schedule_id, user_id) is None:
        return None
    return db.scalar(
        select(ScheduleMagazine).where(
            ScheduleMagazine.schedule_id == schedule_id,
            ScheduleMagazine.template_key == template_key,
        )
    )


def build_magazine_candidates(
    db: Session,
    *,
    schedule_id: int,
    user_id: int,
    template: MagazineTemplate,
    locale: str = "ko",
) -> tuple[ScheduleMagazineResponse, list[dict]] | None:
    draft = build_schedule_magazine(
        db, schedule_id=schedule_id, user_id=user_id, locale=locale
    )
    if draft is None:
        return None
    snapshot = draft.model_dump(mode="json")
    candidates: list[dict] = []
    for page in snapshot["pages"]:
        photos = page.get("photos") or []
        if not photos:
            continue
        photo = next((item for item in photos if item.get("is_winner")), photos[0])
        candidates.append(
            {
                "schedule_mission_id": page["schedule_mission_id"],
                "session_id": page["session_id"],
                "planned_date": page["planned_date"],
                "mission_code": page["mission"]["code"],
                "title": page["mission"]["title"],
                "description": page["mission"]["description"],
                "place_label": page["mission"].get("place_label"),
                "photo_url": photo["photo_url"],
                "comment_count": len(photo.get("comments") or []),
            }
        )
    return draft, candidates


def generate_schedule_magazine(
    db: Session,
    *,
    schedule_id: int,
    user_id: int,
    template: MagazineTemplate,
    locale: str = "ko",
    force: bool = False,
    schedule_mission_ids: list[int] | None = None,
) -> ScheduleMagazine | None:
    draft = build_schedule_magazine(
        db, schedule_id=schedule_id, user_id=user_id, locale=locale
    )
    if draft is None:
        return None

    snapshot = draft.model_dump(mode="json")
    renderable_pages = [page for page in snapshot["pages"] if page.get("photos")]
    snapshot["pages"] = _select_magazine_pages(
        renderable_pages,
        schedule_mission_ids=schedule_mission_ids,
        capacity=template.capacity,
    )
    fingerprint_source = dict(snapshot)
    fingerprint_source.pop("assembled_at", None)
    fingerprint = hashlib.sha256(
        json.dumps(fingerprint_source, ensure_ascii=False, sort_keys=True).encode("utf-8")
    ).hexdigest()

    record = db.scalar(
        select(ScheduleMagazine).where(
            ScheduleMagazine.schedule_id == schedule_id,
            ScheduleMagazine.template_key == template.key,
        )
    )
    if record is None:
        record = ScheduleMagazine(
            schedule_id=schedule_id,
            template_key=template.key,
            locale=locale,
            template_version=template.version,
            status="GENERATING",
            image_urls=[],
            source_snapshot=snapshot,
        )
        db.add(record)
    elif (
        not force
        and record.status == "READY"
        and record.source_fingerprint == fingerprint
        and record.template_version == template.version
    ):
        return record

    record.status = "GENERATING"
    record.locale = locale
    record.template_version = template.version
    record.source_fingerprint = fingerprint
    record.source_snapshot = snapshot
    record.error_message = None
    record.generation_number = db.execute(
        text("SELECT nextval('magazine_generation_number_seq')")
    ).scalar_one()
    snapshot["generation_number"] = record.generation_number
    record.source_snapshot = snapshot
    db.commit()
    db.refresh(record)

    try:
        record.image_urls = render_magazine(template, snapshot, schedule_id)
        record.status = "READY"
        record.generated_at = datetime.now(timezone.utc)
    except MagazineRenderError as exc:
        record.status = "FAILED"
        record.error_message = str(exc)
        db.commit()
        db.refresh(record)
        raise
    except Exception as exc:
        record.status = "FAILED"
        record.error_message = "Unexpected image rendering failure."
        db.commit()
        db.refresh(record)
        raise MagazineRenderError(record.error_message) from exc

    db.commit()
    db.refresh(record)
    return record
