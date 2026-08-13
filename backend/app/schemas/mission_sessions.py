from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, model_validator

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
    CANCELLED = "CANCELLED"


class MissionParticipationDecision(str, Enum):
    PARTICIPATE = "PARTICIPATE"
    PASS = "PASS"


class MissionParticipationStatus(str, Enum):
    UNDECIDED = "UNDECIDED"
    PARTICIPATING = "PARTICIPATING"
    SKIPPED = "SKIPPED"
    LOCKED_OUT = "LOCKED_OUT"
    TIMED_OUT = "TIMED_OUT"
    COMPLETED = "COMPLETED"


class MissionLocationCheckStatus(str, Enum):
    NOT_CHECKED = "NOT_CHECKED"
    NOT_REQUIRED = "NOT_REQUIRED"
    NOT_CONFIGURED = "NOT_CONFIGURED"
    PASSED = "PASSED"
    FAILED = "FAILED"


class MissionParticipationRequest(BaseModel):
    decision: MissionParticipationDecision
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    accuracy_m: float | None = Field(default=None, gt=0)
    measured_at: datetime | None = Field(
        default=None,
        description="Timezone-aware device location measurement time.",
    )

    @model_validator(mode="after")
    def validate_complete_location(self):
        location_values = (
            self.latitude,
            self.longitude,
            self.accuracy_m,
            self.measured_at,
        )
        if any(value is not None for value in location_values) and not all(
            value is not None for value in location_values
        ):
            raise ValueError(
                "latitude, longitude, accuracy_m, and measured_at must be provided together."
            )
        return self


class MissionJudgementStatus(str, Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    PASSED = "PASSED"
    REJECTED = "REJECTED"
    REVIEW = "REVIEW"
    ERROR = "ERROR"


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
    participation_status: MissionParticipationStatus
    decision_at: datetime | None
    excluded_at: datetime | None
    exclusion_reason: str | None
    location_check_status: MissionLocationCheckStatus
    location_id: int | None
    location_accuracy_m: float | None
    location_distance_m: float | None
    location_measured_at: datetime | None
    location_checked_at: datetime | None
    upload_deadline_at: datetime | None
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
    judge_status: MissionJudgementStatus
    similarity_score: float | None
    judge_reason: str | None
    judge_model: str | None
    judged_at: datetime | None
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
    participants_locked_at: datetime | None
    shooting_deadline_at: datetime | None
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
