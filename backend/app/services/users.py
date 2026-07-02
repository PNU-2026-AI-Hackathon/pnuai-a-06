from datetime import datetime, timedelta, timezone
from secrets import randbelow

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import (
    hash_password,
    hash_verification_code,
    verify_code,
    verify_password,
)
from app.models.users import User


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
