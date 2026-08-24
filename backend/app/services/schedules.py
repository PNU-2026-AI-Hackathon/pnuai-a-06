from datetime import date, datetime, timedelta, timezone
from secrets import token_urlsafe

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models.missions import Mission, MissionLocation
from app.models.schedules import (
    MissionSession,
    MissionSchedule,
    ScheduleInviteLink,
    ScheduleMember,
    ScheduleMission,
    UserScheduleOrder,
)
from app.models.users import User
from app.schemas.schedules import (
    MissionScheduleCreateRequest,
    MissionScheduleUpdateRequest,
    ScheduleBasketStatus,
    ScheduleMemberStatus,
    ScheduleMissionStatus,
)
from app.schemas.missions import Theme
from app.core.config import get_settings


class ScheduleDateOverlapError(Exception):
    pass


class ScheduleMissionDateError(Exception):
    pass


class ScheduleOrderError(Exception):
    pass


def _users_by_email(db: Session, emails: list[str]) -> dict[str, User]:
    if not emails:
        return {}
    users = db.scalars(select(User).where(User.email.in_(emails))).all()
    return {user.email: user for user in users if user.email is not None}


def _new_invite_token() -> str:
    return token_urlsafe(32)


def _new_invite_expiration() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=get_settings().schedule_invite_expire_days)


def _display_name(user: User) -> str:
    return user.nickname or user.email or f"user-{user.id}"


def _schedule_load_options():
    return (
        joinedload(MissionSchedule.creator),
        selectinload(MissionSchedule.members).joinedload(ScheduleMember.user),
        selectinload(MissionSchedule.schedule_missions).joinedload(ScheduleMission.mission),
        selectinload(MissionSchedule.schedule_missions)
        .joinedload(ScheduleMission.mission)
        .joinedload(Mission.translations),
        selectinload(MissionSchedule.schedule_missions)
        .joinedload(ScheduleMission.mission)
        .joinedload(Mission.locations)
        .joinedload(MissionLocation.translations),
        selectinload(MissionSchedule.schedule_missions).joinedload(ScheduleMission.winner),
    )


def _sort_schedule_children(schedule: MissionSchedule) -> MissionSchedule:
    schedule.members.sort(key=lambda member: (member.created_at, member.id))
    schedule.schedule_missions.sort(
        key=lambda item: (
            item.planned_date is None,
            item.planned_date or date.max,
            item.visit_order,
            item.created_at,
            item.id,
        )
    )
    return schedule


def _next_schedule_mission_visit_order(
    db: Session,
    *,
    schedule_id: int,
    planned_date: date | None,
) -> int:
    date_condition = (
        ScheduleMission.planned_date.is_(None)
        if planned_date is None
        else ScheduleMission.planned_date == planned_date
    )
    current_max = db.scalar(
        select(func.max(ScheduleMission.visit_order)).where(
            ScheduleMission.schedule_id == schedule_id,
            date_condition,
        )
    )
    return int(current_max or 0) + 1


def _load_schedule(db: Session, schedule_id: int) -> MissionSchedule | None:
    stmt = (
        select(MissionSchedule)
        .where(MissionSchedule.id == schedule_id)
        .options(*_schedule_load_options())
    )
    schedule = db.scalar(stmt)
    return _sort_schedule_children(schedule) if schedule is not None else None


def get_invitation_by_token(db: Session, invite_token: str) -> ScheduleMember | None:
    stmt = (
        select(ScheduleMember)
        .where(ScheduleMember.invite_token == invite_token)
        .options(
            selectinload(ScheduleMember.user),
            selectinload(ScheduleMember.schedule).selectinload(MissionSchedule.creator),
        )
    )
    return db.scalar(stmt)


def get_share_invitation_by_token(db: Session, invite_token: str) -> ScheduleInviteLink | None:
    stmt = (
        select(ScheduleInviteLink)
        .where(ScheduleInviteLink.invite_token == invite_token)
        .options(
            selectinload(ScheduleInviteLink.schedule).selectinload(MissionSchedule.creator),
            selectinload(ScheduleInviteLink.created_by),
        )
    )
    return db.scalar(stmt)


def get_invitation_preview(db: Session, invite_token: str) -> ScheduleMember | None:
    member = get_invitation_by_token(db, invite_token)
    if member is None or member.invite_token_expires_at < datetime.now(timezone.utc):
        return None
    return member


def get_any_invitation_preview(
    db: Session,
    invite_token: str,
) -> tuple[ScheduleMember | ScheduleInviteLink | None, str | None]:
    share_invitation = get_share_invitation_by_token(db, invite_token)
    if share_invitation is not None:
        if share_invitation.expires_at < datetime.now(timezone.utc):
            return None, "expired"
        return share_invitation, "SHARE_LINK"

    member = get_invitation_by_token(db, invite_token)
    if member is not None:
        if member.invite_token_expires_at < datetime.now(timezone.utc):
            return None, "expired"
        return member, "EMAIL"

    return None, None


def user_can_access_schedule(schedule: MissionSchedule, user_id: int) -> bool:
    return schedule.creator_id == user_id or any(
        member.user_id == user_id for member in schedule.members
    )


def user_can_add_schedule_mission(schedule: MissionSchedule, user_id: int) -> bool:
    return schedule.creator_id == user_id or any(
        member.user_id == user_id and member.status == ScheduleMemberStatus.ACCEPTED.value
        for member in schedule.members
    )


def has_overlapping_schedule(
    db: Session,
    *,
    user_id: int,
    start_date: date,
    end_date: date,
    exclude_schedule_id: int | None = None,
) -> bool:
    accepted_membership = select(ScheduleMember.id).where(
        ScheduleMember.schedule_id == MissionSchedule.id,
        ScheduleMember.user_id == user_id,
        ScheduleMember.status == ScheduleMemberStatus.ACCEPTED.value,
    ).exists()
    stmt = select(MissionSchedule.id).where(
        MissionSchedule.status != "CANCELLED",
        MissionSchedule.start_date <= end_date,
        MissionSchedule.end_date >= start_date,
        or_(MissionSchedule.creator_id == user_id, accepted_membership),
    )
    if exclude_schedule_id is not None:
        stmt = stmt.where(MissionSchedule.id != exclude_schedule_id)
    return db.scalar(stmt.limit(1)) is not None


def ensure_no_overlapping_schedule(
    db: Session,
    *,
    user_id: int,
    start_date: date,
    end_date: date,
    exclude_schedule_id: int | None = None,
) -> None:
    if has_overlapping_schedule(
        db,
        user_id=user_id,
        start_date=start_date,
        end_date=end_date,
        exclude_schedule_id=exclude_schedule_id,
    ):
        raise ScheduleDateOverlapError("The user already has an overlapping schedule.")


def list_user_schedules(db: Session, user_id: int) -> list[MissionSchedule]:
    member_access = select(ScheduleMember.id).where(
        ScheduleMember.schedule_id == MissionSchedule.id,
        ScheduleMember.user_id == user_id,
    ).exists()
    stmt = (
        select(MissionSchedule)
        .where(or_(MissionSchedule.creator_id == user_id, member_access))
        .options(*_schedule_load_options())
    )
    schedules = db.scalars(stmt).all()
    saved_order = {
        item.schedule_id: item.position
        for item in db.scalars(
            select(UserScheduleOrder)
            .where(UserScheduleOrder.user_id == user_id)
            .order_by(UserScheduleOrder.position)
        ).all()
    }
    schedules.sort(
        key=lambda schedule: (
            saved_order.get(schedule.id, 1_000_000),
            schedule.start_date,
            schedule.id,
        )
    )
    return [_sort_schedule_children(schedule) for schedule in schedules]


def update_user_schedule_order(
    db: Session,
    *,
    user_id: int,
    schedule_ids: list[int],
) -> list[MissionSchedule] | None:
    if len(schedule_ids) != len(set(schedule_ids)):
        raise ScheduleOrderError("schedule_ids must not contain duplicates.")

    visible_schedules = list_user_schedules(db, user_id)
    visible_ids = {schedule.id for schedule in visible_schedules}
    requested_ids = set(schedule_ids)
    if not requested_ids.issubset(visible_ids):
        raise ScheduleOrderError("The order contains a schedule that is not visible to the user.")

    ordered_ids = [*schedule_ids, *(schedule.id for schedule in visible_schedules if schedule.id not in requested_ids)]
    existing = {
        item.schedule_id: item
        for item in db.scalars(
            select(UserScheduleOrder).where(UserScheduleOrder.user_id == user_id)
        ).all()
    }
    # Free the unique position values before assigning the new order, so a
    # reorder such as [B, A] cannot collide with A/B's old positions.
    for item in existing.values():
        item.position = -(item.position + 1)
    db.flush()
    for position, schedule_id in enumerate(ordered_ids):
        item = existing.get(schedule_id)
        if item is None:
            db.add(UserScheduleOrder(user_id=user_id, schedule_id=schedule_id, position=position))
        else:
            item.position = position
    db.commit()
    return list_user_schedules(db, user_id)


def list_received_invitations(db: Session, user_id: int) -> list[ScheduleMember]:
    stmt = (
        select(ScheduleMember)
        .where(
            ScheduleMember.user_id == user_id,
            ScheduleMember.status == ScheduleMemberStatus.PENDING.value,
            ScheduleMember.invite_token_expires_at >= datetime.now(timezone.utc),
        )
        .options(
            selectinload(ScheduleMember.schedule).selectinload(MissionSchedule.creator),
            selectinload(ScheduleMember.user),
        )
        .order_by(ScheduleMember.created_at.desc(), ScheduleMember.id.desc())
    )
    return list(db.scalars(stmt).all())


def build_received_invitation_response(member: ScheduleMember) -> dict[str, object]:
    return {
        "id": member.id,
        "schedule_id": member.schedule_id,
        "schedule_title": member.schedule.title,
        "start_date": member.schedule.start_date,
        "end_date": member.schedule.end_date,
        "creator": member.schedule.creator,
        "status": member.status,
        "invite_token": member.invite_token,
        "invite_url": member.invite_url,
        "expires_at": member.invite_token_expires_at,
        "created_at": member.created_at,
    }


def create_schedule(
    db: Session,
    *,
    creator_id: int,
    payload: MissionScheduleCreateRequest,
) -> tuple[MissionSchedule | None, list[str]]:
    creator = db.get(User, creator_id)
    creator_email = creator.email if creator is not None else None
    invitee_emails = [
        email for email in payload.invitee_emails if creator_email is None or email != creator_email
    ]
    users_by_email = _users_by_email(db, invitee_emails)
    missing_emails = [email for email in invitee_emails if email not in users_by_email]
    if missing_emails:
        return None, missing_emails
    ensure_no_overlapping_schedule(
        db,
        user_id=creator_id,
        start_date=payload.start_date,
        end_date=payload.end_date,
    )

    schedule = MissionSchedule(
        creator_id=creator_id,
        title=payload.title,
        start_date=payload.start_date,
        end_date=payload.end_date,
    )
    db.add(schedule)
    db.flush()

    for invitee_email in invitee_emails:
        db.add(
            ScheduleMember(
                schedule_id=schedule.id,
                user_id=users_by_email[invitee_email].id,
                invited_by_user_id=creator_id,
                status=ScheduleMemberStatus.PENDING.value,
                invite_email=invitee_email,
                invite_token=_new_invite_token(),
                invite_token_expires_at=_new_invite_expiration(),
            )
        )

    db.commit()
    return _load_schedule(db, schedule.id), []


def get_accessible_schedule(
    db: Session,
    *,
    schedule_id: int,
    user_id: int,
) -> MissionSchedule | None:
    schedule = _load_schedule(db, schedule_id)
    if schedule is None or not user_can_access_schedule(schedule, user_id):
        return None
    return schedule


def list_schedule_baskets(
    db: Session,
    *,
    schedule_id: int,
    user_id: int,
) -> list[dict[str, str | int]] | None:
    schedule = get_accessible_schedule(db, schedule_id=schedule_id, user_id=user_id)
    if schedule is None:
        return None

    counts = {theme.value: 0 for theme in Theme}
    for schedule_mission in schedule.schedule_missions:
        counts[schedule_mission.mission.theme] += 1

    return [
        {
            "theme": theme.value,
            "status": (
                ScheduleBasketStatus.FILLED.value
                if counts[theme.value] > 0
                else ScheduleBasketStatus.EMPTY.value
            ),
            "mission_count": counts[theme.value],
        }
        for theme in Theme
    ]


def create_schedule_share_invitation(
    db: Session,
    *,
    schedule_id: int,
    creator_id: int,
) -> tuple[ScheduleInviteLink | None, str | None]:
    schedule = db.get(MissionSchedule, schedule_id)
    if schedule is None or schedule.creator_id != creator_id:
        return None, "schedule_not_found"

    invitation = ScheduleInviteLink(
        schedule_id=schedule_id,
        created_by_user_id=creator_id,
        invite_token=_new_invite_token(),
        status=ScheduleMemberStatus.PENDING.value,
        expires_at=_new_invite_expiration(),
    )
    db.add(invitation)
    db.commit()
    db.refresh(invitation)
    return db.scalar(
        select(ScheduleInviteLink)
        .where(ScheduleInviteLink.id == invitation.id)
        .options(
            selectinload(ScheduleInviteLink.schedule).selectinload(MissionSchedule.creator),
            selectinload(ScheduleInviteLink.created_by),
        )
    ), None


def build_share_invitation_response(invitation: ScheduleInviteLink) -> dict[str, object]:
    return {
        "room_id": invitation.schedule_id,
        "room_name": invitation.schedule.title,
        "inviter_name": _display_name(invitation.created_by),
        "invite_token": invitation.invite_token,
        "invite_url": invitation.invite_url,
        "expires_at": invitation.expires_at,
    }


def update_schedule(
    db: Session,
    *,
    schedule_id: int,
    creator_id: int,
    payload: MissionScheduleUpdateRequest,
) -> MissionSchedule | None:
    schedule = db.get(MissionSchedule, schedule_id)
    if schedule is None or schedule.creator_id != creator_id:
        return None

    next_start_date = payload.start_date if payload.start_date is not None else schedule.start_date
    next_end_date = payload.end_date if payload.end_date is not None else schedule.end_date
    if next_end_date < next_start_date:
        raise ValueError("end_date must be on or after start_date.")

    if payload.status is None or payload.status.value != "CANCELLED":
        participant_ids = {schedule.creator_id}
        participant_ids.update(
            member.user_id
            for member in schedule.members
            if member.status == ScheduleMemberStatus.ACCEPTED.value
        )
        for participant_id in participant_ids:
            ensure_no_overlapping_schedule(
                db,
                user_id=participant_id,
                start_date=next_start_date,
                end_date=next_end_date,
                exclude_schedule_id=schedule_id,
            )

    if payload.title is not None:
        schedule.title = payload.title
    if payload.start_date is not None:
        schedule.start_date = payload.start_date
    if payload.end_date is not None:
        schedule.end_date = payload.end_date
    if payload.status is not None:
        schedule.status = payload.status.value

    db.commit()
    return _load_schedule(db, schedule.id)


def delete_schedule(
    db: Session,
    *,
    schedule_id: int,
    creator_id: int,
) -> bool:
    schedule = db.get(MissionSchedule, schedule_id)
    if schedule is None or schedule.creator_id != creator_id:
        return False

    db.delete(schedule)
    db.commit()
    return True


def invite_schedule_member(
    db: Session,
    *,
    schedule_id: int,
    creator_id: int,
    invitee_email: str,
) -> tuple[ScheduleMember | None, str | None]:
    schedule = db.get(MissionSchedule, schedule_id)
    if schedule is None or schedule.creator_id != creator_id:
        return None, "schedule_not_found"

    invitee = db.scalar(select(User).where(User.email == invitee_email))
    if invitee is None:
        return None, "user_not_found"
    if invitee.id == creator_id:
        return None, "creator_cannot_be_invited"

    stmt = select(ScheduleMember).where(
        ScheduleMember.schedule_id == schedule_id,
        ScheduleMember.user_id == invitee.id,
    )
    member = db.scalar(stmt)
    if member is None:
        member = ScheduleMember(
            schedule_id=schedule_id,
            user_id=invitee.id,
            invited_by_user_id=creator_id,
            status=ScheduleMemberStatus.PENDING.value,
            invite_email=invitee_email,
            invite_token=_new_invite_token(),
            invite_token_expires_at=_new_invite_expiration(),
        )
        db.add(member)
    elif member.status == ScheduleMemberStatus.DECLINED.value:
        member.status = ScheduleMemberStatus.PENDING.value
        member.invited_by_user_id = creator_id
        member.invite_email = invitee_email
        member.invite_token = _new_invite_token()
        member.invite_token_expires_at = _new_invite_expiration()

    db.commit()
    db.refresh(member)
    return db.scalar(
        select(ScheduleMember)
        .where(ScheduleMember.id == member.id)
        .options(selectinload(ScheduleMember.user))
    ), None


def update_my_membership(
    db: Session,
    *,
    schedule_id: int,
    user_id: int,
    status: ScheduleMemberStatus,
) -> ScheduleMember | None:
    stmt = (
        select(ScheduleMember)
        .where(ScheduleMember.schedule_id == schedule_id, ScheduleMember.user_id == user_id)
        .options(selectinload(ScheduleMember.user))
    )
    member = db.scalar(stmt)
    if member is None:
        return None
    member.status = status.value
    db.commit()
    db.refresh(member)
    return member


def update_membership_by_invite_token(
    db: Session,
    *,
    invite_token: str,
    user: User,
    status: ScheduleMemberStatus,
) -> tuple[ScheduleMember | None, str | None]:
    member = get_invitation_by_token(db, invite_token)
    if member is None:
        return None, "invitation_not_found"
    if member.invite_token_expires_at < datetime.now(timezone.utc):
        return None, "invitation_expired"
    if user.email is None or user.email != member.invite_email:
        return None, "email_mismatch"

    if status == ScheduleMemberStatus.ACCEPTED:
        try:
            ensure_no_overlapping_schedule(
                db,
                user_id=user.id,
                start_date=member.schedule.start_date,
                end_date=member.schedule.end_date,
                exclude_schedule_id=member.schedule_id,
            )
        except ScheduleDateOverlapError:
            return None, "schedule_date_overlap"

    member.user_id = user.id
    member.status = status.value
    db.commit()
    db.refresh(member)
    return db.scalar(
        select(ScheduleMember)
        .where(ScheduleMember.id == member.id)
        .options(selectinload(ScheduleMember.user))
    ), None


def accept_share_invitation_by_token(
    db: Session,
    *,
    invite_token: str,
    user: User,
) -> tuple[ScheduleMember | None, str | None]:
    invitation = get_share_invitation_by_token(db, invite_token)
    if invitation is None:
        return None, "invitation_not_found"
    if invitation.expires_at < datetime.now(timezone.utc):
        return None, "invitation_expired"
    if invitation.status != ScheduleMemberStatus.PENDING.value:
        return None, "invitation_already_used"
    if invitation.schedule.creator_id == user.id:
        return None, "creator_cannot_join"
    try:
        ensure_no_overlapping_schedule(
            db,
            user_id=user.id,
            start_date=invitation.schedule.start_date,
            end_date=invitation.schedule.end_date,
            exclude_schedule_id=invitation.schedule_id,
        )
    except ScheduleDateOverlapError:
        return None, "schedule_date_overlap"

    stmt = select(ScheduleMember).where(
        ScheduleMember.schedule_id == invitation.schedule_id,
        ScheduleMember.user_id == user.id,
    )
    member = db.scalar(stmt)
    if member is None:
        member = ScheduleMember(
            schedule_id=invitation.schedule_id,
            user_id=user.id,
            invited_by_user_id=invitation.created_by_user_id,
            status=ScheduleMemberStatus.ACCEPTED.value,
            invite_email=user.email,
            invite_token=_new_invite_token(),
            invite_token_expires_at=invitation.expires_at,
        )
        db.add(member)
    else:
        member.status = ScheduleMemberStatus.ACCEPTED.value

    invitation.status = ScheduleMemberStatus.ACCEPTED.value
    invitation.accepted_by_user_id = user.id
    invitation.accepted_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(member)
    return db.scalar(
        select(ScheduleMember)
        .where(ScheduleMember.id == member.id)
        .options(selectinload(ScheduleMember.user))
    ), None


def add_schedule_mission(
    db: Session,
    *,
    schedule_id: int,
    user_id: int,
    mission_id: int,
    planned_date: date | None = None,
) -> tuple[ScheduleMission | None, str | None]:
    schedule = _load_schedule(db, schedule_id)
    if schedule is None or not user_can_add_schedule_mission(schedule, user_id):
        return None, "schedule_not_found"
    if db.get(Mission, mission_id) is None:
        return None, "mission_not_found"
    if planned_date is not None and not (schedule.start_date <= planned_date <= schedule.end_date):
        return None, "mission_date_out_of_range"

    stmt = select(ScheduleMission).where(
        ScheduleMission.schedule_id == schedule_id,
        ScheduleMission.mission_id == mission_id,
    )
    schedule_mission = db.scalar(stmt)
    if schedule_mission is None:
        schedule_mission = ScheduleMission(
            schedule_id=schedule_id,
            mission_id=mission_id,
            added_by_user_id=user_id,
            status=ScheduleMissionStatus.ADDED.value,
            planned_date=planned_date,
            visit_order=_next_schedule_mission_visit_order(
                db,
                schedule_id=schedule_id,
                planned_date=planned_date,
            ),
        )
        db.add(schedule_mission)

    db.commit()
    db.refresh(schedule_mission)
    return db.scalar(
        select(ScheduleMission)
        .where(ScheduleMission.id == schedule_mission.id)
        .options(
            selectinload(ScheduleMission.mission).selectinload(Mission.translations),
            selectinload(ScheduleMission.mission)
            .selectinload(Mission.locations)
            .selectinload(MissionLocation.translations),
        )
    ), None


def update_schedule_mission_date(
    db: Session,
    *,
    schedule_id: int,
    schedule_mission_id: int,
    creator_id: int,
    planned_date: date | None,
) -> tuple[ScheduleMission | None, str | None]:
    schedule = db.get(MissionSchedule, schedule_id)
    if schedule is None or schedule.creator_id != creator_id:
        return None, "schedule_not_found"
    if planned_date is not None and not (schedule.start_date <= planned_date <= schedule.end_date):
        return None, "mission_date_out_of_range"
    schedule_mission = db.scalar(
        select(ScheduleMission)
        .where(
            ScheduleMission.id == schedule_mission_id,
            ScheduleMission.schedule_id == schedule_id,
        )
    )
    if schedule_mission is None:
        return None, "schedule_mission_not_found"
    if schedule_mission.planned_date != planned_date:
        schedule_mission.planned_date = planned_date
        schedule_mission.visit_order = _next_schedule_mission_visit_order(
            db,
            schedule_id=schedule_id,
            planned_date=planned_date,
        )
    db.commit()
    return db.scalar(
        select(ScheduleMission)
        .where(ScheduleMission.id == schedule_mission.id)
        .options(
            selectinload(ScheduleMission.mission).selectinload(Mission.translations),
            selectinload(ScheduleMission.mission)
            .selectinload(Mission.locations)
            .selectinload(MissionLocation.translations),
            selectinload(ScheduleMission.winner),
        )
    ), None


def delete_schedule_mission(
    db: Session,
    *,
    schedule_id: int,
    schedule_mission_id: int,
    user_id: int,
) -> tuple[bool, str | None]:
    schedule = _load_schedule(db, schedule_id)
    if schedule is None or schedule.creator_id != user_id:
        return False, "creator_only" if schedule is not None else "schedule_not_found"

    schedule_mission = db.scalar(
        select(ScheduleMission)
        .where(
            ScheduleMission.id == schedule_mission_id,
            ScheduleMission.schedule_id == schedule_id,
        )
        .with_for_update()
    )
    if schedule_mission is None:
        return False, "schedule_mission_not_found"

    if schedule_mission.status != ScheduleMissionStatus.ADDED.value:
        return False, "mission_in_progress"

    has_started_session = db.scalar(
        select(MissionSession.id)
        .where(
            MissionSession.schedule_mission_id == schedule_mission_id,
            MissionSession.status != "WAITING",
        )
        .limit(1)
    )
    if has_started_session is not None:
        return False, "mission_in_progress"

    db.delete(schedule_mission)
    db.commit()
    return True, None
