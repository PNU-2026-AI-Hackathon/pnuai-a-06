from typing import Any

import httpx
from fastapi import HTTPException, status

from app.core.config import Settings

KAKAO_TOKEN_URL = "https://kauth.kakao.com/oauth/token"
KAKAO_USER_INFO_URL = "https://kapi.kakao.com/v2/user/me"
KAKAO_UNLINK_URL = "https://kapi.kakao.com/v1/user/unlink"


async def exchange_code_for_token(code: str, settings: Settings) -> str:
    data = {
        "grant_type": "authorization_code",
        "client_id": settings.kakao_rest_api_key,
        "redirect_uri": settings.kakao_redirect_uri,
        "code": code,
    }
    if settings.kakao_client_secret:
        data["client_secret"] = settings.kakao_client_secret

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(
            KAKAO_TOKEN_URL,
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded;charset=utf-8"},
        )

    if response.status_code >= 400:
        try:
            error_detail = response.json()
        except ValueError:
            error_detail = response.text
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"message": "Failed to exchange Kakao authorization code.", "kakao": error_detail},
        )

    token_data = response.json()
    access_token = token_data.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Kakao token response did not include access_token.",
        )
    return access_token


async def fetch_kakao_user(access_token: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(
            KAKAO_USER_INFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )

    if response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to fetch Kakao user information.",
        )
    return response.json()


def normalize_kakao_user(payload: dict[str, Any]) -> dict[str, str | None]:
    kakao_account = payload.get("kakao_account") or {}
    profile = kakao_account.get("profile") or {}

    kakao_id = payload.get("id")
    if kakao_id is None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Kakao user response did not include id.",
        )

    email = kakao_account.get("email")
    if kakao_account.get("is_email_valid") is False:
        email = None

    return {
        "kakao_id": str(kakao_id),
        "email": email,
        "nickname": profile.get("nickname"),
        "profile_image_url": profile.get("profile_image_url"),
    }


async def unlink_kakao_user_with_admin_key(
    *,
    kakao_id: str,
    admin_key: str,
) -> None:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                KAKAO_UNLINK_URL,
                data={
                    "target_id_type": "user_id",
                    "target_id": kakao_id,
                },
                headers={
                    "Authorization": f"KakaoAK {admin_key}",
                    "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
                },
            )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "code": "KAKAO_UNLINK_UNAVAILABLE",
                "message": "Kakao unlink service is unavailable.",
            },
        ) from exc

    if response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "code": "KAKAO_UNLINK_FAILED",
                "message": "Failed to unlink the Kakao account.",
            },
        )

    try:
        unlinked_id = str(response.json().get("id"))
    except (AttributeError, ValueError):
        unlinked_id = ""

    if unlinked_id != kakao_id:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "code": "KAKAO_UNLINK_INVALID_RESPONSE",
                "message": "Kakao returned an invalid unlink response.",
            },
        )
