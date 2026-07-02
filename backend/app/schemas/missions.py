from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class Theme(str, Enum):
    MOUNTAIN = "MOUNTAIN"
    SEA = "SEA"
    CITY = "CITY"


class MissionType(str, Enum):
    BASIC = "BASIC"
    RARE = "RARE"
    SIDE = "SIDE"


class VerificationType(str, Enum):
    PHOTO = "PHOTO"
    GPS_PHOTO = "GPS_PHOTO"
    FREE_PHOTO = "FREE_PHOTO"


class BasketStatus(str, Enum):
    EMPTY = "EMPTY"
    FILLED = "FILLED"
    FULL = "FULL"
    OVERFLOWING = "OVERFLOWING"


class CartItemStatus(str, Enum):
    ADDED = "ADDED"
    IN_PROGRESS = "IN_PROGRESS"
    SUBMITTED = "SUBMITTED"
    COMPLETED = "COMPLETED"


class MissionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(description="Internal mission numeric id.")
    mission_set_id: int = Field(description="Basket theme id that owns this mission.")
    code: str = Field(description="Stable mission code, also used as the image filename.")
    theme: Theme = Field(description="Basket theme: MOUNTAIN, SEA, or CITY.")
    district_code: str = Field(
        description="Structured Busan district code for map/filter use, e.g. YEONGDO or ALL_BUSAN."
    )
    district_label: str = Field(
        description="Human-readable Busan district label, e.g. 영도구 or 부산 전역."
    )
    type: MissionType = Field(description="Mission category: BASIC, RARE, or SIDE.")
    title: str = Field(description="Mission title shown to users.")
    description: str = Field(description="Mission instruction shown to users.")
    unlock_condition: str | None = Field(
        description="Text explaining when the mission unlocks. Null means no lock."
    )
    verification_type: VerificationType = Field(
        description="How the mission should be verified later. Current API does not judge completion."
    )
    target_keyword: str | None = Field(
        description="Optional external search keyword. Currently unused because photos are manual."
    )
    target_photo_id: str | None = Field(
        description="Manual photo id. Currently the same value as mission code."
    )
    target_photo_url: str | None = Field(
        description="Static image URL for the mission target photo."
    )
    reward_item_name: str = Field(description="Reward item name displayed after mission progress.")
    reward_item_icon: str = Field(description="Temporary reward item icon.")
    sort_order: int = Field(description="Display order inside the basket.")
    created_at: datetime = Field(description="Row creation time.")
    updated_at: datetime = Field(description="Row update time.")


class MissionSetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(description="Internal basket theme numeric id.")
    theme: Theme = Field(description="Basket theme: MOUNTAIN, SEA, or CITY.")
    title: str = Field(description="Basket title shown to users.")
    region_label: str = Field(description="Short theme/category label for the basket, not a district.")
    description: str | None = Field(description="Basket description shown on list/detail screens.")
    sort_order: int = Field(description="Display order for basket cards.")
    created_at: datetime = Field(description="Row creation time.")
    updated_at: datetime = Field(description="Row update time.")


class MissionSetDetailResponse(MissionSetResponse):
    missions: list[MissionResponse] = Field(description="Missions belonging to this basket.")


class DistrictResponse(BaseModel):
    district_code: str = Field(description="Structured Busan district code.")
    district_label: str = Field(description="Human-readable Busan district label.")
    mission_count: int = Field(description="Number of missions available in this district.")


class BasketResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(description="Internal user basket numeric id.")
    user_id: int = Field(description="Owner user id.")
    theme: Theme = Field(description="Basket theme: MOUNTAIN, SEA, or CITY.")
    status: BasketStatus = Field(
        description="User basket visual state. Currently EMPTY changes to FILLED when a mission is added."
    )
    created_at: datetime = Field(description="Row creation time.")
    updated_at: datetime = Field(description="Row update time.")


class CartItemCreateRequest(BaseModel):
    mission_id: int = Field(gt=0, description="Mission id to add to the logged-in user's basket.")


class CartItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = Field(description="Internal selected-mission numeric id.")
    user_id: int = Field(description="Owner user id.")
    mission_id: int = Field(description="Selected mission id.")
    status: CartItemStatus = Field(
        description="Selection workflow state. This is not final mission completion judging yet."
    )
    mission: MissionResponse = Field(description="Selected mission detail.")
    created_at: datetime = Field(description="Row creation time.")
    updated_at: datetime = Field(description="Row update time.")
