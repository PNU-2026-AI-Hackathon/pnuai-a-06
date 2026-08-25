from datetime import datetime, timedelta, timezone
from secrets import randbelow

from sqlalchemy import select
from sqlalchemy.orm import Session, object_session

from app.core.security import (
    hash_password,
    hash_verification_code,
    verify_code,
    verify_password,
)
from app.models.users import User


MAX_PASSWORD_RESET_ATTEMPTS = 5


class EmailAccountNotRegisteredError(Exception):
    pass


class EmailAccountNotVerifiedError(Exception):
    pass


def get_or_create_kakao_user(
    db: Session,
    *,
    kakao_id: str,
    email: str | None,
    nickname: str | None,
    profile_image_url: str | None,
) -> User:
    stmt = select(User).where(
        User.provider == "kakao",
        User.provider_user_id == kakao_id,
    )
    user = db.scalar(stmt)
    now = datetime.now(timezone.utc)

    if user is None:
        user = User(
            provider="kakao",
            provider_user_id=kakao_id,
            email=email,
            nickname=nickname,
            profile_image_url=profile_image_url,
            last_login_at=now,
        )
        db.add(user)
    else:
        user.email = email
        user.nickname = nickname
        user.profile_image_url = profile_image_url
        user.last_login_at = now

    db.commit()
    db.refresh(user)
    return user


def _managed_user(db: Session, user: User) -> User:
    """Attach a user returned by the short-lived auth session when needed."""
    if object_session(user) is db or not hasattr(db, "merge"):
        return user
    return db.merge(user)


def delete_user_account(db: Session, user: User) -> None:
    db.delete(_managed_user(db, user))
    db.commit()


def create_email_verification_code() -> str:
    return f"{randbelow(1_000_000):06d}"


def get_email_user(db: Session, email: str) -> User | None:
    stmt = select(User).where(
        User.provider == "email",
        User.provider_user_id == email,
    )
    return db.scalar(stmt)


def register_email_user(
    db: Session,
    *,
    email: str,
    password: str,
    name: str,
    expires_in_minutes: int,
) -> tuple[User, str]:
    user = get_email_user(db, email)
    if user is not None and user.email_verified_at is not None:
        raise ValueError("Email is already registered.")

    now = datetime.now(timezone.utc)
    code = create_email_verification_code()

    if user is None:
        user = User(
            provider="email",
            provider_user_id=email,
            email=email,
            password_hash=hash_password(password),
            nickname=name,
        )
        db.add(user)
    else:
        user.password_hash = hash_password(password)
        user.nickname = name
        user.email = email

    user.email_verification_code_hash = hash_verification_code(code)
    user.email_verification_expires_at = now + timedelta(minutes=expires_in_minutes)

    db.commit()
    db.refresh(user)
    return user, code


def verify_email_user(db: Session, *, email: str, code: str) -> User | None:
    user = get_email_user(db, email)
    if user is None:
        return None

    now = datetime.now(timezone.utc)
    if user.email_verification_expires_at is None:
        return None
    if user.email_verification_expires_at < now:
        return None
    if not verify_code(code, user.email_verification_code_hash):
        return None

    user.email_verified_at = now
    user.email_verification_code_hash = None
    user.email_verification_expires_at = None
    user.last_login_at = now
    db.commit()
    db.refresh(user)
    return user


def require_verified_email_user(db: Session, email: str) -> User:
    user = get_email_user(db, email)
    if user is None:
        raise EmailAccountNotRegisteredError
    if user.email_verified_at is None:
        raise EmailAccountNotVerifiedError
    return user


def request_email_password_reset(
    db: Session,
    *,
    email: str,
    expires_in_minutes: int,
) -> tuple[User, str]:
    user = require_verified_email_user(db, email)
    code = create_email_verification_code()
    now = datetime.now(timezone.utc)

    user.password_reset_code_hash = hash_verification_code(code)
    user.password_reset_expires_at = now + timedelta(minutes=expires_in_minutes)
    user.password_reset_attempts = 0

    db.commit()
    db.refresh(user)
    return user, code


def reset_email_password(
    db: Session,
    *,
    email: str,
    code: str,
    new_password: str,
) -> User | None:
    user = require_verified_email_user(db, email)
    now = datetime.now(timezone.utc)

    if user.password_reset_expires_at is None:
        return None
    if user.password_reset_expires_at < now:
        user.password_reset_code_hash = None
        user.password_reset_expires_at = None
        user.password_reset_attempts = 0
        db.commit()
        return None

    if not verify_code(code, user.password_reset_code_hash):
        user.password_reset_attempts += 1
        if user.password_reset_attempts >= MAX_PASSWORD_RESET_ATTEMPTS:
            user.password_reset_code_hash = None
            user.password_reset_expires_at = None
            user.password_reset_attempts = 0
        db.commit()
        return None

    user.password_hash = hash_password(new_password)
    user.password_reset_code_hash = None
    user.password_reset_expires_at = None
    user.password_reset_attempts = 0
    db.commit()
    db.refresh(user)
    return user


def authenticate_email_user(db: Session, *, email: str, password: str) -> User | None:
    user = get_email_user(db, email)
    if user is None:
        return None
    if user.email_verified_at is None:
        return None
    if not verify_password(password, user.password_hash):
        return None

    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    return user


def update_user_profile(
    db: Session,
    user: User,
    *,
    nickname: str | None = None,
    profile_image_url: str | None = None,
    profile_emoji: str | None = None,
    update_nickname: bool = False,
    update_profile_image_url: bool = False,
    update_profile_emoji: bool = False,
) -> User:
    user = _managed_user(db, user)
    if update_nickname:
        user.nickname = nickname
    if update_profile_image_url:
        user.profile_image_url = profile_image_url
    if update_profile_emoji:
        user.profile_emoji = profile_emoji

    db.commit()
    db.refresh(user)
    return user
