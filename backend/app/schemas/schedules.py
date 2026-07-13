from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.auth.schemas import normalize_email
from app.schemas.missions import MissionResponse


class ScheduleStatus(str, Enum):
    ACTIVE = "ACTIVE"
    CANCELLED = "CANCELLED"


class ScheduleMemberStatus(str, Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    DECLINED = "DECLINED"


class ScheduleMissionStatus(str, Enum):
    ADDED = "ADDED"
    IN_PROGRESS = "IN_PROGRESS"
    SUBMITTED = "SUBMITTED"
    COMPLETED = "COMPLETED"


class ScheduleBasketStatus(str, Enum):
    EMPTY = "EMPTY"
    FILLED = "FILLED"


class ScheduleUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(description="User id.")
    email: str | None = Field(description="User email, if available.")
    nickname: str | None = Field(description="User nickname.")
    profile_image_url: str | None = Field(description="User profile image URL.")
    profile_emoji: str | None = Field(description="User profile emoji.")


class MissionScheduleCreateRequest(BaseModel):
    title: str = Field(default="부산 미션 일정", min_length=1, max_length=120)
    start_date: date = Field(description="Schedule start date, e.g. 2026-07-12.")
    end_date: date = Field(description="Schedule end date, e.g. 2026-07-15.")
    invitee_emails: list[str] = Field(
        default_factory=list,
        description="User emails to invite as companions when creating the schedule.",
    )

    @field_validator("title", mode="before")
    @classmethod
    def strip_title(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("invitee_emails")
    @classmethod
    def validate_invitee_emails(cls, value: list[str]) -> list[str]:
        seen: set[str] = set()
        unique_emails: list[str] = []
        for email in value:
            normalized_email = normalize_email(email)
            if normalized_email not in seen:
                unique_emails.append(normalized_email)
                seen.add(normalized_email)
        return unique_emails

    @model_validator(mode="after")
    def validate_date_range(self):
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date.")
        return self


class MissionScheduleUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=120)
    start_date: date | None = None
    end_date: date | None = None
    status: ScheduleStatus | None = None

    @field_validator("title", mode="before")
    @classmethod
    def strip_optional_title(cls, value):
        return value.strip() if isinstance(value, str) else value


class ScheduleInviteRequest(BaseModel):
    email: str = Field(description="User email to invite.")

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return normalize_email(value)


class ScheduleMembershipUpdateRequest(BaseModel):
    status: ScheduleMemberStatus = Field(description="Use ACCEPTED or DECLINED.")

    @field_validator("status")
    @classmethod
    def validate_member_status(cls, value: ScheduleMemberStatus) -> ScheduleMemberStatus:
        if value == ScheduleMemberStatus.PENDING:
            raise ValueError("Use ACCEPTED or DECLINED when updating your invitation.")
        return value


class ScheduleMissionCreateRequest(BaseModel):
    mission_id: int = Field(gt=0, description="Mission id to add to this schedule.")


class ScheduleMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(description="Membership row id.")
    user_id: int = Field(description="Invited user id.")
    invited_by_user_id: int = Field(description="Creator/inviter user id.")
    status: ScheduleMemberStatus = Field(description="Invitation status.")
    invite_email: str = Field(description="Email address that was invited.")
    invite_token: str = Field(description="Share token used by the frontend invite link.")
    invite_url: str | None = Field(description="Frontend share URL for this invitation.")
    invite_token_expires_at: datetime = Field(description="Invite token expiration time.")
    user: ScheduleUserResponse = Field(description="Invited user profile.")
    created_at: datetime
    updated_at: datetime


class ScheduleInvitationPreviewResponse(BaseModel):
    schedule_id: int = Field(description="Invited schedule id.")
    schedule_title: str = Field(description="Invited schedule title.")
    start_date: date = Field(description="Schedule start date.")
    end_date: date = Field(description="Schedule end date.")
    creator: ScheduleUserResponse = Field(description="Schedule creator.")
    invite_email: str | None = Field(description="Email address that was invited, if targeted.")
    status: ScheduleMemberStatus = Field(description="Current invitation status.")
    expires_at: datetime = Field(description="Invite token expiration time.")
    invite_type: str = Field(description="Invitation type: EMAIL or SHARE_LINK.")


class ReceivedScheduleInvitationResponse(BaseModel):
    id: int = Field(description="Membership invitation row id.")
    schedule_id: int = Field(description="Invited schedule id.")
    schedule_title: str = Field(description="Invited schedule title.")
    start_date: date = Field(description="Schedule start date.")
    end_date: date = Field(description="Schedule end date.")
    creator: ScheduleUserResponse = Field(description="Schedule creator.")
    status: ScheduleMemberStatus = Field(description="Current invitation status.")
    invite_token: str = Field(description="Token to use with invitation accept/decline APIs.")
    invite_url: str | None = Field(description="Frontend invitation URL.")
    expires_at: datetime = Field(description="Invitation token expiration time.")
    created_at: datetime = Field(description="Invitation creation time.")


class ScheduleShareInvitationResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    room_id: int = Field(
        alias="roomId",
        description="Schedule id to pass as Kakao template argument.",
    )
    room_name: str = Field(
        alias="roomName",
        description="Schedule title to show in Kakao message.",
    )
    inviter_name: str = Field(
        alias="inviterName",
        description="Inviter display name to show in Kakao message.",
    )
    invite_token: str = Field(
        alias="inviteToken",
        description="Invite token to pass as Kakao template argument.",
    )
    invite_url: str | None = Field(
        alias="inviteUrl",
        description="Deep/app link for Kakao button.",
    )
    expires_at: datetime = Field(
        alias="expiresAt",
        description="Invite token expiration time.",
    )


class ScheduleBasketResponse(BaseModel):
    theme: str = Field(description="Basket theme: MOUNTAIN, SEA, or CITY.")
    status: ScheduleBasketStatus = Field(description="Theme basket state inside this schedule.")
    mission_count: int = Field(description="Number of missions added for this theme.")


class ScheduleMissionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(description="Schedule mission row id.")
    mission_id: int = Field(description="Mission id.")
    added_by_user_id: int = Field(description="User who added this mission.")
    status: ScheduleMissionStatus = Field(description="Schedule mission progress status.")
    mission: MissionResponse = Field(description="Mission detail.")
    created_at: datetime
    updated_at: datetime


class MissionScheduleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(description="Schedule id.")
    creator_id: int = Field(description="User id that created this schedule.")
    title: str = Field(description="Schedule title.")
    start_date: date = Field(description="Schedule start date.")
    end_date: date = Field(description="Schedule end date.")
    status: ScheduleStatus = Field(description="Schedule status.")
    creator: ScheduleUserResponse = Field(description="Schedule creator.")
    companions: list[ScheduleMemberResponse] = Field(
        description="Invited/participating users. The creator is kept separate."
    )
    participants: list[ScheduleUserResponse] = Field(
        description="Creator and accepted schedule participants with nickname and profile image."
    )
    missions: list[ScheduleMissionResponse] = Field(
        description="Missions added to this schedule."
    )
    created_at: datetime
    updated_at: datetime
