from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.schedules import ScheduleUserResponse


class MagazineCommentResponse(BaseModel):
    id: int
    user_id: int
    content: str
    created_at: datetime
    user: ScheduleUserResponse


class MagazinePhotoResponse(BaseModel):
    submission_id: int
    user_id: int
    photo_url: str
    captured_at: datetime | None
    uploaded_at: datetime
    like_count: int
    is_winner: bool
    user: ScheduleUserResponse
    comments: list[MagazineCommentResponse]


class MagazineMissionResponse(BaseModel):
    code: str
    title: str
    description: str
    emoji_url: str | None
    district_code: str
    district_label: str
    place_label: str | None


class MagazinePageResponse(BaseModel):
    page_index: int = Field(ge=0)
    template_key: str | None = Field(
        default=None,
        description="Template identifier. Null until magazine templates are added.",
    )
    schedule_mission_id: int
    session_id: int
    planned_date: date | None
    mission: MagazineMissionResponse
    winner_user_id: int | None
    winner: ScheduleUserResponse | None
    headline: str
    body_text: str | None = Field(
        default=None,
        description="Reserved for a later rule-based or AI-generated magazine story.",
    )
    featured_comment: MagazineCommentResponse | None
    photos: list[MagazinePhotoResponse]


class MagazineCoverResponse(BaseModel):
    template_key: str | None = None
    title: str
    subtitle: str
    photo_url: str | None


class MagazineWinnerCountResponse(BaseModel):
    user_id: int
    win_count: int
    user: ScheduleUserResponse


class MagazineSummaryResponse(BaseModel):
    completed_mission_count: int
    total_photo_count: int
    visited_places: list[str]
    winner_counts: list[MagazineWinnerCountResponse]


class ScheduleMagazineResponse(BaseModel):
    version: int = 1
    locale: str = "ko"
    schedule_id: int
    title: str
    start_date: date
    end_date: date
    assembled_at: datetime
    participants: list[ScheduleUserResponse]
    cover: MagazineCoverResponse
    pages: list[MagazinePageResponse]
    summary: MagazineSummaryResponse


class MagazineGenerateRequest(BaseModel):
    template_key: str = Field(default="handwriting-2025-v1", min_length=1, max_length=100)
    force: bool = Field(default=False, description="Regenerate even when source data is unchanged.")
    schedule_mission_ids: list[int] | None = Field(
        default=None,
        min_length=1,
        description=(
            "Ordered schedule mission ids to include. Required when the number of "
            "renderable missions exceeds the selected frame capacity."
        ),
    )

    @field_validator("schedule_mission_ids")
    @classmethod
    def validate_unique_schedule_missions(cls, value: list[int] | None) -> list[int] | None:
        if value is not None and len(value) != len(set(value)):
            raise ValueError("schedule_mission_ids must not contain duplicates.")
        return value


class MagazineTemplateResponse(BaseModel):
    key: str
    name: str
    version: int
    width: int
    height: int
    output_width: int
    output_height: int
    mission_capacity_per_image: int


class GeneratedMagazineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    schedule_id: int
    template_key: str
    locale: str = Field(description="Language embedded in the currently stored image.")
    template_version: int
    generation_number: int
    status: str
    image_urls: list[str]
    error_message: str | None
    generated_at: datetime | None
    created_at: datetime
    updated_at: datetime


class MagazineMissionCandidateResponse(BaseModel):
    schedule_mission_id: int
    session_id: int
    planned_date: date | None
    mission_code: str
    title: str
    description: str
    place_label: str | None
    photo_url: str
    comment_count: int


class MagazineCandidatesResponse(BaseModel):
    schedule_id: int
    template_key: str
    locale: str = "ko"
    max_selectable: int
    selection_required: bool
    candidates: list[MagazineMissionCandidateResponse]
