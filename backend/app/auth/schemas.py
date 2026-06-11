from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    provider: str
    provider_user_id: str
    email: str | None
    nickname: str | None
    profile_image_url: str | None
    created_at: datetime
    updated_at: datetime
    last_login_at: datetime | None
