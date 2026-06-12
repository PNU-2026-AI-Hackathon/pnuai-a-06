from typing import Any

from secrets import token_urlsafe
from urllib.parse import urlencode

from fastapi import APIRouter, Cookie, Depends, HTTPException, Query, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.kakao import (
    exchange_code_for_token,
    fetch_kakao_user,
    normalize_kakao_user,
)
from app.auth.schemas import TokenResponse, UserResponse
from app.core.config import Settings, get_settings
from app.core.security import create_access_token
from app.db.session import get_db
from app.users.models import User
from app.users.service import get_or_create_kakao_user

router = APIRouter(prefix="/auth", tags=["auth"])

KAKAO_AUTHORIZE_URL = "https://kauth.kakao.com/oauth/authorize"
STATE_COOKIE_NAME = "kakao_oauth_state"
FRONTEND_REDIRECT_COOKIE_NAME = "frontend_redirect_uri"


@router.get("/kakao/login")
def kakao_login(
    frontend_redirect_uri: str | None = Query(default=None),
    settings: Settings = Depends(get_settings),
) -> RedirectResponse:
    if not settings.kakao_rest_api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="KAKAO_REST_API_KEY is not configured.",
        )

    state = token_urlsafe(32)
    params = {
        "response_type": "code",
        "client_id": settings.kakao_rest_api_key,
        "redirect_uri": settings.kakao_redirect_uri,
        "state": state,
    }
    response = RedirectResponse(f"{KAKAO_AUTHORIZE_URL}?{urlencode(params)}")
    response.set_cookie(
        STATE_COOKIE_NAME,
        state,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=600,
    )
    if frontend_redirect_uri:
        response.set_cookie(
            FRONTEND_REDIRECT_COOKIE_NAME,
            frontend_redirect_uri,
            httponly=True,
            secure=False,
            samesite="lax",
            max_age=600,
        )
    return response


@router.get("/kakao/callback", response_model=None)
async def kakao_callback(
    response: Response,
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    error_description: str | None = Query(default=None),
    saved_state: str | None = Cookie(default=None, alias=STATE_COOKIE_NAME),
    saved_frontend_redirect_uri: str | None = Cookie(
        default=None,
        alias=FRONTEND_REDIRECT_COOKIE_NAME,
    ),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> Any:
    if error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_description or error,
        )
    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Kakao authorization code.",
        )
    if not state or not saved_state or state != saved_state:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Kakao OAuth state.",
        )

    kakao_access_token = await exchange_code_for_token(code, settings)
    kakao_payload = await fetch_kakao_user(kakao_access_token)
    normalized_user = normalize_kakao_user(kakao_payload)

    user = get_or_create_kakao_user(db, **normalized_user)
    access_token = create_access_token(subject=str(user.id))

    frontend_redirect_uri = saved_frontend_redirect_uri or settings.frontend_redirect_uri

    if frontend_redirect_uri:
        redirect_params = urlencode({"token": access_token, "user_id": user.id})
        redirect_response = RedirectResponse(
            f"{frontend_redirect_uri}?{redirect_params}"
        )
        redirect_response.delete_cookie(STATE_COOKIE_NAME)
        redirect_response.delete_cookie(FRONTEND_REDIRECT_COOKIE_NAME)
        return redirect_response

    response.delete_cookie(STATE_COOKIE_NAME)
    response.delete_cookie(FRONTEND_REDIRECT_COOKIE_NAME)
    return TokenResponse(access_token=access_token, user_id=user.id)


@router.get("/me", response_model=UserResponse)
def read_me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
