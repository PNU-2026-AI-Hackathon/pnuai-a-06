from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.schedules import ScheduleUserResponse
from app.schemas.missions import MissionResponse


class MissionSessionStatus(str, Enum):
    WAITING = "WAITING"
    READY = "READY"
    SHOOTING = "SHOOTING"
    UPLOADING = "UPLOADING"
    VOTING = "VOTING"
    REVEALED = "REVEALED"
    COMPLETED = "COMPLETED"


class MissionSessionCreateResponse(BaseModel):
    id: int
    schedule_mission_id: int
    status: MissionSessionStatus
    created_by_user_id: int
    created_at: datetime


class MissionSessionMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    ready_at: datetime | None
    joined_at: datetime
    user: ScheduleUserResponse


class MissionSubmissionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    photo_url: str
    captured_at: datetime | None
    uploaded_at: datetime
    like_count: int
    comments: list["MissionSubmissionCommentResponse"]
    user: ScheduleUserResponse


class MissionSubmissionCommentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    content: str
    created_at: datetime
    user: ScheduleUserResponse


class MissionSubmissionCommentCreateRequest(BaseModel):
    content: str = Field(min_length=1, max_length=1000)


class MissionSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: int
    schedule_mission_id: int
    status: MissionSessionStatus
    created_by_user_id: int
    started_at: datetime | None
    revealed_at: datetime | None
    completed_at: datetime | None
    expires_at: datetime | None
    voting_expires_at: datetime | None
    winner_user_id: int | None
    created_at: datetime
    mission: MissionResponse
    members: list[MissionSessionMemberResponse]
    submissions: list[MissionSubmissionResponse]


class MissionSessionPhotoResponse(BaseModel):
    submission: MissionSubmissionResponse
