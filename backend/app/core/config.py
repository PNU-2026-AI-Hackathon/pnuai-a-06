from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    database_url: str = Field(
        default="postgresql+psycopg://postgres:postgres@localhost:5432/jjigeukka",
        alias="DATABASE_URL",
    )

    kakao_rest_api_key: str = Field(default="", alias="KAKAO_REST_API_KEY")
    kakao_client_secret: str = Field(default="", alias="KAKAO_CLIENT_SECRET")
    kakao_redirect_uri: str = Field(
        default="http://localhost:8000/auth/kakao/callback",
        alias="KAKAO_REDIRECT_URI",
    )

    frontend_redirect_uri: str = Field(default="", alias="FRONTEND_REDIRECT_URI")
    cors_origins: str = Field(default="", alias="CORS_ORIGINS")

    jwt_secret_key: str = Field(
        default="replace-this-with-a-long-random-secret",
        alias="JWT_SECRET_KEY",
    )
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(
        default=60,
        alias="ACCESS_TOKEN_EXPIRE_MINUTES",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
