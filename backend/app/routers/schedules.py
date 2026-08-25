from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.core.localization import resolve_locale
from app.db.session import get_db
from app.models.users import User
from app.schemas.schedules import (
    MissionScheduleCreateRequest,
    MissionScheduleResponse,
    MissionScheduleUpdateRequest,
    ReceivedScheduleInvitationResponse,
    ScheduleBasketResponse,
    ScheduleInviteRequest,
    ScheduleMissionUpdateRequest,
    ScheduleOrderUpdateRequest,
    ScheduleInvitationPreviewResponse,
    ScheduleMemberResponse,
    ScheduleMemberStatus,
    ScheduleMissionCreateRequest,
    ScheduleMissionOrderRecommendationResponse,
    ScheduleMissionResponse,
    ScheduleShareInvitationResponse,
)
from app.services.schedules import (
    accept_share_invitation_by_token,
    add_schedule_mission,
    build_received_invitation_response,
    build_share_invitation_response,
    create_schedule_share_invitation,
    create_schedule,
    delete_schedule,
    delete_schedule_mission,
    get_accessible_schedule,
    get_any_invitation_preview,
    invite_schedule_member,
    list_received_invitations,
    list_schedule_baskets,
    list_user_schedules,
    ScheduleDateOverlapError,
    ScheduleMissionDateError,
    ScheduleOrderError,
    update_membership_by_invite_token,
    update_schedule_mission_date,
    update_user_schedule_order,
    update_schedule,
)
from app.services.localization import (
    localized_schedule,
    localized_schedule_mission,
)
from app.services.mission_route_recommendations import (
    MissionRouteRecommendationError,
    recommend_schedule_mission_order,
)

schedules_router = APIRouter(prefix="/schedules", tags=["schedules"])
schedule_missions_router = APIRouter(prefix="/schedules", tags=["schedule missions"])
schedule_invitations_router = APIRouter(prefix="/schedules", tags=["schedule invitations"])
invitations_router = APIRouter(prefix="/invitations", tags=["schedule invitations"])

# Backward-compatible alias used by app.main.
router = schedules_router
invitation_router = invitations_router


@schedules_router.get(
    "",
    response_model=list[MissionScheduleResponse],
    summary="List my schedules",
    description=(
        "Returns schedules created by the logged-in user and schedules where the user "
        "has been invited. Creator and companions are separated in the response."
    ),
)
def read_my_schedules(
    locale: str = Depends(resolve_locale),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[MissionScheduleResponse]:
    return [
        localized_schedule(schedule, locale)
        for schedule in list_user_schedules(db, current_user.id)
    ]


@schedules_router.post(
    "",
    response_model=MissionScheduleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a schedule",
    description=(
        "Creates a mission schedule with a date range. Optional invitee emails are "
        "stored as PENDING companions. The creator is stored separately and is not "
        "duplicated in companions."
    ),
    responses={
        404: {"description": "One or more invitee emails were not found."},
        409: {"description": "The creator already has an overlapping schedule."},
    },
)
def create_mission_schedule(
    payload: MissionScheduleCreateRequest,
    locale: str = Depends(resolve_locale),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MissionScheduleResponse:
    try:
        schedule, missing_ids = create_schedule(db, creator_id=current_user.id, payload=payload)
    except ScheduleDateOverlapError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    if schedule is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "Invitee email not found.", "missing_emails": missing_ids},
        )
    return localized_schedule(schedule, locale)


@schedules_router.put(
    "/order",
    response_model=list[MissionScheduleResponse],
    summary="Update the current user's schedule order",
    responses={400: {"description": "The order contains duplicate or inaccessible schedules."}},
)
def reorder_my_schedules(
    payload: ScheduleOrderUpdateRequest,
    locale: str = Depends(resolve_locale),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[MissionScheduleResponse]:
    try:
        schedules = update_user_schedule_order(
            db, user_id=current_user.id, schedule_ids=payload.schedule_ids
        )
        return [localized_schedule(schedule, locale) for schedule in schedules]
    except ScheduleOrderError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@schedules_router.get(
    "/{schedule_id}",
    response_model=MissionScheduleResponse,
    summary="Get one schedule",
    responses={404: {"description": "Schedule was not found or is not accessible."}},
)
def read_mission_schedule(
    schedule_id: int,
    locale: str = Depends(resolve_locale),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MissionScheduleResponse:
    schedule = get_accessible_schedule(db, schedule_id=schedule_id, user_id=current_user.id)
    if schedule is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mission schedule not found.",
        )
    return localized_schedule(schedule, locale)


@schedule_invitations_router.post(
    "/{schedule_id}/share-invitations",
    response_model=ScheduleShareInvitationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a Kakao share invitation",
    description=(
        "Creates a one-use invite token for KakaoTalk sharing. The frontend should "
        "pass roomId, roomName, inviterName, inviteToken, and inviteUrl "
        "into the Kakao share template."
    ),
    responses={404: {"description": "Schedule was not found or the user is not the creator."}},
)
def create_schedule_share_invite(
    schedule_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ScheduleShareInvitationResponse:
    invitation, error = create_schedule_share_invitation(
        db,
        schedule_id=schedule_id,
        creator_id=current_user.id,
    )
    if invitation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mission schedule not found.",
        )
    return build_share_invitation_response(invitation)


@schedule_missions_router.get(
    "/{schedule_id}/baskets",
    response_model=list[ScheduleBasketResponse],
    summary="Get theme basket states for a schedule",
    description=(
        "Returns MOUNTAIN, SEA, CITY, and DEMO category states for the selected schedule. "
        "States are calculated from missions added to this schedule, not from a "
        "user-wide basket."
    ),
    responses={404: {"description": "Schedule was not found or is not accessible."}},
)
def read_schedule_baskets(
    schedule_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ScheduleBasketResponse]:
    baskets = list_schedule_baskets(db, schedule_id=schedule_id, user_id=current_user.id)
    if baskets is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mission schedule not found.",
        )
    return baskets


@schedules_router.patch(
    "/{schedule_id}",
    response_model=MissionScheduleResponse,
    summary="Update a schedule",
    description="Only the schedule creator can change the title, date range, or status.",
    responses={
        400: {"description": "Invalid date range."},
        404: {"description": "Schedule was not found or the user is not the creator."},
        409: {"description": "The creator or an accepted participant has an overlapping schedule."},
    },
)
def update_mission_schedule(
    schedule_id: int,
    payload: MissionScheduleUpdateRequest,
    locale: str = Depends(resolve_locale),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MissionScheduleResponse:
    try:
        schedule = update_schedule(
            db,
            schedule_id=schedule_id,
            creator_id=current_user.id,
            payload=payload,
        )
    except ScheduleDateOverlapError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if schedule is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mission schedule not found.",
        )
    return localized_schedule(schedule, locale)


@schedules_router.delete(
    "/{schedule_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a schedule",
    description="Only the schedule creator can delete the schedule and its related members, missions, and invitations.",
    responses={404: {"description": "Schedule was not found or the user is not the creator."}},
)
def delete_mission_schedule(
    schedule_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    deleted = delete_schedule(
        db,
        schedule_id=schedule_id,
        creator_id=current_user.id,
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mission schedule not found.",
        )


@schedule_invitations_router.post(
    "/{schedule_id}/invitations",
    response_model=ScheduleMemberResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Invite a companion to a schedule",
    description=(
        "Only the schedule creator can invite companions. Re-inviting a declined "
        "member moves that membership back to PENDING."
    ),
    responses={
        400: {"description": "The creator cannot be invited as a companion."},
        404: {"description": "Schedule or invited email was not found."},
    },
)
def create_schedule_invitation(
    schedule_id: int,
    payload: ScheduleInviteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ScheduleMemberResponse:
    member, error = invite_schedule_member(
        db,
        schedule_id=schedule_id,
        creator_id=current_user.id,
        invitee_email=payload.email,
    )
    if error == "creator_cannot_be_invited":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Schedule creator cannot be invited as a companion.",
        )
    if member is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mission schedule or invited email not found.",
        )
    return member


# This overlaps with token-based invitation accept/decline and is intentionally
# not exposed. Keep the token flow as the single frontend path.
# @schedule_invitations_router.patch(
#     "/{schedule_id}/membership/me",
#     response_model=ScheduleMemberResponse,
#     summary="Accept or decline my schedule invitation",
#     responses={404: {"description": "Invitation was not found."}},
# )
# def update_my_schedule_membership(
#     schedule_id: int,
#     payload: ScheduleMembershipUpdateRequest,
#     current_user: User = Depends(get_current_user),
#     db: Session = Depends(get_db),
# ) -> ScheduleMemberResponse:
#     member = update_my_membership(
#         db,
#         schedule_id=schedule_id,
#         user_id=current_user.id,
#         status=payload.status,
#     )
#     if member is None:
#         raise HTTPException(
#             status_code=status.HTTP_404_NOT_FOUND,
#             detail="Schedule invitation not found.",
#         )
#     return member


@schedule_missions_router.post(
    "/{schedule_id}/missions",
    response_model=ScheduleMissionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a mission to a schedule",
    description=(
        "Adds a mission to the selected schedule. The schedule creator or invited "
        "companions can add missions. Adding the same mission again returns the "
        "existing schedule mission."
    ),
    responses={
        404: {"description": "Schedule was not found/not accessible, or mission was not found."}
    },
)
def create_schedule_mission(
    schedule_id: int,
    payload: ScheduleMissionCreateRequest,
    locale: str = Depends(resolve_locale),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ScheduleMissionResponse:
    schedule_mission, error = add_schedule_mission(
        db,
        schedule_id=schedule_id,
        user_id=current_user.id,
        mission_id=payload.mission_id,
        planned_date=payload.planned_date,
    )
    if schedule_mission is None:
        if error == "mission_not_found":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mission not found.")
        if error == "mission_date_out_of_range":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="planned_date must be within the schedule date range.")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mission schedule not found.")
    return localized_schedule_mission(schedule_mission, locale)


@schedule_missions_router.post(
    "/{schedule_id}/days/{planned_date}/recommend-order",
    response_model=ScheduleMissionOrderRecommendationResponse,
    summary="Recommend and apply a day's mission visit order",
    description=(
        "Uses OpenAI to recommend a rough geographic visit order for only the "
        "missions assigned to the requested date, validates the returned ids, and "
        "persists the new one-based visit order. Only the schedule creator can run it."
    ),
    responses={
        400: {"description": "The date is outside the schedule range."},
        404: {"description": "Schedule was not found or the user is not its creator."},
        409: {"description": "No missions exist for the date, or they changed during generation."},
        502: {"description": "OpenAI did not return a usable recommendation."},
        503: {"description": "OpenAI is not configured."},
    },
)
def recommend_day_mission_order(
    schedule_id: int,
    planned_date: date,
    locale: str = Depends(resolve_locale),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ScheduleMissionOrderRecommendationResponse:
    try:
        schedule_missions = recommend_schedule_mission_order(
            db,
            schedule_id=schedule_id,
            creator_id=current_user.id,
            planned_date=planned_date,
        )
    except MissionRouteRecommendationError as error:
        status_by_code = {
            "MISSION_DATE_OUT_OF_RANGE": status.HTTP_400_BAD_REQUEST,
            "SCHEDULE_NOT_FOUND": status.HTTP_404_NOT_FOUND,
            "NO_MISSIONS_FOR_DATE": status.HTTP_409_CONFLICT,
            "SCHEDULE_MISSIONS_CHANGED": status.HTTP_409_CONFLICT,
            "ROUTE_RECOMMENDATION_UNAVAILABLE": status.HTTP_502_BAD_GATEWAY,
            "OPENAI_NOT_CONFIGURED": status.HTTP_503_SERVICE_UNAVAILABLE,
        }
        raise HTTPException(
            status_code=status_by_code.get(error.code, status.HTTP_502_BAD_GATEWAY),
            detail={"code": error.code, "message": error.message},
        ) from error

    return ScheduleMissionOrderRecommendationResponse(
        planned_date=planned_date,
        missions=[
            localized_schedule_mission(schedule_mission, locale)
            for schedule_mission in schedule_missions
        ],
    )


@schedule_missions_router.patch(
    "/{schedule_id}/missions/{schedule_mission_id}",
    response_model=ScheduleMissionResponse,
    summary="Update a scheduled mission date",
    responses={
        400: {"description": "The planned date is outside the schedule range."},
        404: {"description": "Schedule or schedule mission was not found."},
    },
)
def update_scheduled_mission(
    schedule_id: int,
    schedule_mission_id: int,
    payload: ScheduleMissionUpdateRequest,
    locale: str = Depends(resolve_locale),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ScheduleMissionResponse:
    schedule_mission, error = update_schedule_mission_date(
        db,
        schedule_id=schedule_id,
        schedule_mission_id=schedule_mission_id,
        creator_id=current_user.id,
        planned_date=payload.planned_date,
    )
    if schedule_mission is None:
        if error == "mission_date_out_of_range":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="planned_date must be within the schedule date range.")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule or schedule mission not found.")
    return localized_schedule_mission(schedule_mission, locale)


@schedule_missions_router.delete(
    "/{schedule_id}/missions/{schedule_mission_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a mission from a schedule",
    description=(
        "Removes a mission that has not started yet. Missions with an active, "
        "submitted, or completed execution cannot be removed."
    ),
    responses={
        404: {"description": "Schedule or schedule mission was not found."},
        403: {"description": "Only the schedule creator can remove a mission."},
        409: {"description": "The mission is already in progress or completed."},
    },
)
def remove_schedule_mission(
    schedule_id: int,
    schedule_mission_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    deleted, error = delete_schedule_mission(
        db,
        schedule_id=schedule_id,
        schedule_mission_id=schedule_mission_id,
        user_id=current_user.id,
    )
    if deleted:
        return
    if error == "creator_only":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the schedule creator can remove a mission.",
        )
    if error == "mission_in_progress":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A mission that is in progress or completed cannot be removed.",
        )
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Mission schedule or schedule mission not found.",
    )


@invitations_router.get(
    "/me",
    response_model=list[ReceivedScheduleInvitationResponse],
    summary="List my received email invitations",
    description=(
        "Returns pending email-targeted schedule invitations for the logged-in user. "
        "Use each invite_token with `/invitations/{invite_token}/accept` or "
        "`/invitations/{invite_token}/decline`."
    ),
)
def read_my_received_invitations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ReceivedScheduleInvitationResponse]:
    return [
        build_received_invitation_response(member)
        for member in list_received_invitations(db, current_user.id)
    ]


@invitations_router.get(
    "/{invite_token}",
    response_model=ScheduleInvitationPreviewResponse,
    summary="Preview a schedule invitation link",
    description=(
        "Returns safe invitation details for a shared invite link. The frontend can "
        "call this when a user opens `/invitations/{token}` before asking "
        "them to log in or accept."
    ),
    responses={404: {"description": "Invitation was not found or expired."}},
)
def preview_schedule_invitation(
    invite_token: str,
    db: Session = Depends(get_db),
) -> ScheduleInvitationPreviewResponse:
    invitation, invite_type = get_any_invitation_preview(db, invite_token)
    if invitation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule invitation not found.",
        )
    if invite_type == "SHARE_LINK":
        return {
            "schedule_id": invitation.schedule_id,
            "schedule_title": invitation.schedule.title,
            "start_date": invitation.schedule.start_date,
            "end_date": invitation.schedule.end_date,
            "creator": invitation.schedule.creator,
            "invite_email": None,
            "status": invitation.status,
            "expires_at": invitation.expires_at,
            "invite_type": invite_type,
        }
    return {
        "schedule_id": invitation.schedule_id,
        "schedule_title": invitation.schedule.title,
        "start_date": invitation.schedule.start_date,
        "end_date": invitation.schedule.end_date,
        "creator": invitation.schedule.creator,
        "invite_email": invitation.invite_email,
        "status": invitation.status,
        "expires_at": invitation.invite_token_expires_at,
        "invite_type": invite_type,
    }


@invitations_router.post(
    "/{invite_token}/accept",
    response_model=ScheduleMemberResponse,
    summary="Accept a schedule invitation link",
    description=(
        "Accepts an invitation from a shared link. This flow works for both email "
        "and Kakao accounts, including Kakao accounts without an email address."
    ),
    responses={
        403: {"description": "The invitation cannot be accepted by this account."},
        404: {"description": "Invitation was not found or expired."},
    },
)
def accept_schedule_invitation(
    invite_token: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ScheduleMemberResponse:
    share_member, share_error = accept_share_invitation_by_token(
        db,
        invite_token=invite_token,
        user=current_user,
    )
    if share_member is not None:
        return share_member
    if share_error == "schedule_date_overlap":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have an overlapping schedule.",
        )
    if share_error in {"invitation_already_used", "creator_cannot_join"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=share_error,
        )
    member, error = update_membership_by_invite_token(
        db,
        invite_token=invite_token,
        user=current_user,
        status=ScheduleMemberStatus.ACCEPTED,
    )
    if error == "email_mismatch":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Logged-in user email does not match this invitation.",
        )
    if error == "schedule_date_overlap":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have an overlapping schedule.",
        )
    if member is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule invitation not found.",
        )
    return member


@invitations_router.post(
    "/{invite_token}/decline",
    response_model=ScheduleMemberResponse,
    summary="Decline a schedule invitation link",
    responses={
        403: {"description": "The logged-in user's email does not match the invitation."},
        404: {"description": "Invitation was not found or expired."},
    },
)
def decline_schedule_invitation(
    invite_token: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ScheduleMemberResponse:
    member, error = update_membership_by_invite_token(
        db,
        invite_token=invite_token,
        user=current_user,
        status=ScheduleMemberStatus.DECLINED,
    )
    if error == "email_mismatch":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Logged-in user email does not match this invitation.",
        )
    if member is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Schedule invitation not found.",
        )
    return member
