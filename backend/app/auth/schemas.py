from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


def normalize_email(value: str) -> str:
    email = value.strip().lower()
    if "@" not in email or email.startswith("@") or email.endswith("@"):
        raise ValueError("Invalid email address.")
    return email


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_id: int


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class EmailRegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=100)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return normalize_email(value)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return value.strip()


class EmailLoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return normalize_email(value)


class KakaoTokenLoginRequest(BaseModel):
    kakao_access_token: str = Field(min_length=1)

    @field_validator("kakao_access_token", mode="before")
    @classmethod
    def strip_token(cls, value):
        return value.strip() if isinstance(value, str) else value


class EmailVerifyRequest(BaseModel):
    email: str
    code: str = Field(min_length=6, max_length=6)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return normalize_email(value)

    @field_validator("code")
    @classmethod
    def validate_code(cls, value: str) -> str:
        code = value.strip()
        if not code.isdigit():
            raise ValueError("Verification code must contain digits only.")
        return code


class EmailPasswordResetRequest(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return normalize_email(value)


class EmailPasswordResetConfirmRequest(BaseModel):
    email: str
    code: str = Field(min_length=6, max_length=6)
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        return normalize_email(value)

    @field_validator("code")
    @classmethod
    def validate_code(cls, value: str) -> str:
        code = value.strip()
        if not code.isdigit():
            raise ValueError("Verification code must contain digits only.")
        return code


class EmailVerificationResponse(BaseModel):
    message: str
    expires_in_minutes: int
    dev_verification_code: str | None = None


class EmailPasswordResetConfirmResponse(BaseModel):
    message: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    provider: str
    provider_user_id: str
    email: str | None
    nickname: str | None
    profile_image_url: str | None
    profile_emoji: str | None
    email_verified_at: datetime | None
    created_at: datetime
    updated_at: datetime
    last_login_at: datetime | None


class UserUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nickname: str | None = Field(default=None, min_length=1, max_length=100)

    @field_validator("nickname", mode="before")
    @classmethod
    def strip_optional_text(cls, value):
        return value.strip() if isinstance(value, str) else value


class ProfileEmojiUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    profile_emoji: str = Field(min_length=1, max_length=32)

    @field_validator("profile_emoji", mode="before")
    @classmethod
    def strip_emoji_text(cls, value):
        return value.strip() if isinstance(value, str) else value
