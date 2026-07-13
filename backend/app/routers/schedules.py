from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.models.users import User
from app.schemas.schedules import (
    MissionScheduleCreateRequest,
    MissionScheduleResponse,
    MissionScheduleUpdateRequest,
    ReceivedScheduleInvitationResponse,
    ScheduleBasketResponse,
    ScheduleInviteRequest,
    ScheduleInvitationPreviewResponse,
    ScheduleMemberResponse,
    ScheduleMemberStatus,
    ScheduleMissionCreateRequest,
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
    get_accessible_schedule,
    get_any_invitation_preview,
    invite_schedule_member,
    list_received_invitations,
    list_schedule_baskets,
    list_user_schedules,
    update_membership_by_invite_token,
    update_schedule,
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[MissionScheduleResponse]:
    return list_user_schedules(db, current_user.id)


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
    responses={404: {"description": "One or more invitee emails were not found."}},
)
def create_mission_schedule(
    payload: MissionScheduleCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MissionScheduleResponse:
    schedule, missing_ids = create_schedule(db, creator_id=current_user.id, payload=payload)
    if schedule is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "Invitee email not found.", "missing_emails": missing_ids},
        )
    return schedule


@schedules_router.get(
    "/{schedule_id}",
    response_model=MissionScheduleResponse,
    summary="Get one schedule",
    responses={404: {"description": "Schedule was not found or is not accessible."}},
)
def read_mission_schedule(
    schedule_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MissionScheduleResponse:
    schedule = get_accessible_schedule(db, schedule_id=schedule_id, user_id=current_user.id)
    if schedule is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mission schedule not found.",
        )
    return schedule


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
        "Returns MOUNTAIN, SEA, and CITY basket states for the selected schedule. "
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
    },
)
def update_mission_schedule(
    schedule_id: int,
    payload: MissionScheduleUpdateRequest,
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
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if schedule is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mission schedule not found.",
        )
    return schedule


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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ScheduleMissionResponse:
    schedule_mission, error = add_schedule_mission(
        db,
        schedule_id=schedule_id,
        user_id=current_user.id,
        mission_id=payload.mission_id,
    )
    if schedule_mission is None:
        detail = "Mission not found." if error == "mission_not_found" else "Mission schedule not found."
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)
    return schedule_mission


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
        "Accepts an invitation from a shared link. The logged-in user's email must "
        "match the invited email embedded in the invitation."
    ),
    responses={
        403: {"description": "The logged-in user's email does not match the invitation."},
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
    if share_error in {"invitation_already_used", "creator_cannot_join"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=share_error,
        )
    if share_error == "email_required":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Logged-in user must have an email to accept this invitation.",
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
