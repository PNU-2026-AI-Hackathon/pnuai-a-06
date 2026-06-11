from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.users.models import User


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
