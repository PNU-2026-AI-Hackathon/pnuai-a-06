import base64
import json
from pathlib import Path
import secrets
import shutil
from typing import Any

from secrets import token_urlsafe
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from fastapi import (
    APIRouter,
    Cookie,
    Depends,
    File,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.email import send_verification_email
from app.auth.kakao import (
    exchange_code_for_token,
    fetch_kakao_user,
    normalize_kakao_user,
)
from app.auth.schemas import (
    EmailLoginRequest,
    EmailRegisterRequest,
    EmailVerificationResponse,
    EmailVerifyRequest,
    KakaoTokenLoginRequest,
    ProfileEmojiUpdateRequest,
    RefreshTokenRequest,
    TokenResponse,
    UserResponse,
    UserUpdateRequest,
)
from app.core.config import Settings, get_settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
)
from app.db.session import get_db
from app.models.users import User
from app.services.users import (
    authenticate_email_user,
    get_or_create_kakao_user,
    register_email_user,
    update_user_profile,
    verify_email_user,
)

router = APIRouter(prefix="/auth", tags=["auth"])

KAKAO_AUTHORIZE_URL = "https://kauth.kakao.com/oauth/authorize"
STATE_COOKIE_NAME = "kakao_oauth_state"
FRONTEND_REDIRECT_COOKIE_NAME = "frontend_redirect_uri"
PROFILE_IMAGE_DIR = Path("app/db/profile-images")
PROFILE_IMAGE_MEDIA_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024


def create_token_response(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(subject=str(user.id)),
        refresh_token=create_refresh_token(subject=str(user.id)),
        user_id=user.id,
    )


def encode_oauth_state(
    nonce: str,
    frontend_redirect_uri: str | None = None,
) -> str:
    payload = {"nonce": nonce}
    if frontend_redirect_uri:
        payload["frontend_redirect_uri"] = frontend_redirect_uri

    encoded_payload = base64.urlsafe_b64encode(
        json.dumps(payload, separators=(",", ":")).encode("utf-8")
    ).decode("ascii")
    return encoded_payload.rstrip("=")


def decode_oauth_state(state: str) -> tuple[str, str | None]:
    padding = "=" * (-len(state) % 4)
    try:
        payload = json.loads(
            base64.urlsafe_b64decode(f"{state}{padding}").decode("utf-8")
        )
    except (ValueError, json.JSONDecodeError):
        return state, None

    if not isinstance(payload, dict):
        return state, None

    nonce = payload.get("nonce")
    frontend_redirect_uri = payload.get("frontend_redirect_uri")
    if not isinstance(nonce, str):
        return state, None
    if frontend_redirect_uri is not None and not isinstance(frontend_redirect_uri, str):
        frontend_redirect_uri = None
    return nonce, frontend_redirect_uri


def append_query_params(url: str, params: dict[str, Any]) -> str:
    parsed_url = urlsplit(url)
    query_params = dict(parse_qsl(parsed_url.query, keep_blank_values=True))
    query_params.update(params)
    return urlunsplit(
        (
            parsed_url.scheme,
            parsed_url.netloc,
            parsed_url.path,
            urlencode(query_params),
            parsed_url.fragment,
        )
    )


def get_profile_image_path(filename: str) -> Path:
    if Path(filename).name != filename:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile image not found.",
        )
    return PROFILE_IMAGE_DIR / filename


def save_profile_image(file: UploadFile, user_id: int) -> str:
    extension = PROFILE_IMAGE_MEDIA_TYPES.get(file.content_type or "")
    if extension is None:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Profile image must be JPEG, PNG, or WebP.",
        )

    PROFILE_IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"user-{user_id}-{secrets.token_urlsafe(12)}{extension}"
    image_path = PROFILE_IMAGE_DIR / filename
    temp_path = image_path.with_suffix(f"{image_path.suffix}.tmp")

    total_size = 0
    try:
        with temp_path.open("wb") as output:
            while chunk := file.file.read(1024 * 1024):
                total_size += len(chunk)
                if total_size > MAX_PROFILE_IMAGE_BYTES:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="Profile image must be 5MB or smaller.",
                    )
                output.write(chunk)

        if total_size == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Profile image file is empty.",
            )

        shutil.move(str(temp_path), image_path)
    finally:
        file.file.close()
        if temp_path.exists():
            temp_path.unlink()

    return f"/auth/profile-images/{filename}"


# Kakao login is intentionally disabled while email login is used.
# @router.get("/kakao/login")
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
    oauth_state = encode_oauth_state(state, frontend_redirect_uri)
    params = {
        "response_type": "code",
        "client_id": settings.kakao_rest_api_key,
        "redirect_uri": settings.kakao_redirect_uri,
        "state": oauth_state,
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


# Kakao callback is intentionally disabled while email login is used.
# @router.get("/kakao/callback", response_model=None)
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
    if not state or not saved_state:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Kakao OAuth state.",
        )

    state_nonce, state_frontend_redirect_uri = decode_oauth_state(state)
    if state_nonce != saved_state:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Kakao OAuth state.",
        )

    kakao_access_token = await exchange_code_for_token(code, settings)
    kakao_payload = await fetch_kakao_user(kakao_access_token)
    normalized_user = normalize_kakao_user(kakao_payload)

    user = get_or_create_kakao_user(db, **normalized_user)
    access_token = create_access_token(subject=str(user.id))

    frontend_redirect_uri = (
        state_frontend_redirect_uri
        or saved_frontend_redirect_uri
        or settings.frontend_redirect_uri
    )

    if frontend_redirect_uri:
        redirect_response = RedirectResponse(
            append_query_params(
                frontend_redirect_uri,
                {"token": access_token, "user_id": str(user.id)},
            )
        )
        redirect_response.delete_cookie(STATE_COOKIE_NAME)
        redirect_response.delete_cookie(FRONTEND_REDIRECT_COOKIE_NAME)
        return redirect_response

    response.delete_cookie(STATE_COOKIE_NAME)
    response.delete_cookie(FRONTEND_REDIRECT_COOKIE_NAME)
    return create_token_response(user)


@router.post("/kakao/token", response_model=TokenResponse)
async def login_with_kakao_access_token(
    payload: KakaoTokenLoginRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    kakao_payload = await fetch_kakao_user(payload.kakao_access_token)
    normalized_user = normalize_kakao_user(kakao_payload)
    user = get_or_create_kakao_user(db, **normalized_user)
    return create_token_response(user)


@router.post("/email/register", response_model=EmailVerificationResponse)
def register_with_email(
    payload: EmailRegisterRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> EmailVerificationResponse:
    try:
        _, code = register_email_user(
            db,
            email=payload.email,
            password=payload.password,
            name=payload.name,
            expires_in_minutes=settings.email_verification_expire_minutes,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    sent = send_verification_email(settings, to_email=payload.email, code=code)
    return EmailVerificationResponse(
        message="Verification code sent." if sent else "Verification code created.",
        expires_in_minutes=settings.email_verification_expire_minutes,
        dev_verification_code=None if sent else code,
    )


@router.post("/email/verify", response_model=TokenResponse)
def verify_email(
    payload: EmailVerifyRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    user = verify_email_user(db, email=payload.email, code=payload.code)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification code.",
        )

    return create_token_response(user)


@router.post("/email/login", response_model=TokenResponse)
def login_with_email(
    payload: EmailLoginRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    user = authenticate_email_user(db, email=payload.email, password=payload.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email, password, or unverified email.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return create_token_response(user)


@router.post("/token", response_model=TokenResponse)
async def login_with_oauth_form(
    request: Request,
    db: Session = Depends(get_db),
) -> TokenResponse:
    form_data = dict(parse_qsl((await request.body()).decode("utf-8")))
    username = form_data.get("username", "")
    password = form_data.get("password", "")
    user = authenticate_email_user(
        db,
        email=username,
        password=password,
    )
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email, password, or unverified email.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return create_token_response(user)


@router.post("/token/refresh", response_model=TokenResponse)
def refresh_token(
    payload: RefreshTokenRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    user_id = decode_refresh_token(payload.refresh_token)
    if user_id is None or not user_id.isdigit():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.get(User, int(user_id))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return create_token_response(user)


@router.get("/me", response_model=UserResponse)
def read_me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.patch("/me", response_model=UserResponse)
def update_me(
    payload: UserUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    fields_to_update = payload.model_fields_set
    return update_user_profile(
        db,
        current_user,
        nickname=payload.nickname,
        update_nickname="nickname" in fields_to_update,
    )


@router.post("/me/profile-image", response_model=UserResponse)
def upload_my_profile_image(
    image: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    profile_image_url = save_profile_image(image, current_user.id)
    return update_user_profile(
        db,
        current_user,
        profile_image_url=profile_image_url,
        profile_emoji=None,
        update_profile_image_url=True,
        update_profile_emoji=True,
    )


@router.patch("/me/profile-emoji", response_model=UserResponse)
def update_my_profile_emoji(
    payload: ProfileEmojiUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    return update_user_profile(
        db,
        current_user,
        profile_image_url=None,
        profile_emoji=payload.profile_emoji,
        update_profile_image_url=True,
        update_profile_emoji=True,
    )


@router.get("/profile-images/{filename}", response_class=FileResponse)
def read_profile_image(filename: str) -> FileResponse:
    image_path = get_profile_image_path(filename)
    if not image_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile image not found.",
        )

    return FileResponse(image_path, filename=image_path.name)
