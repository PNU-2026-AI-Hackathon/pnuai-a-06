from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.core.security import decode_access_token
from app.db.session import SessionLocal
from app.models.users import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


def get_current_user(
    token: str = Depends(oauth2_scheme),
) -> User:
    user_id = decode_access_token(token)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Authentication and the route body are separate thread-pool stages. If
    # they share the route's generator session, a burst can leave many checked
    # out connections waiting for a worker to run the route body. Authenticate
    # in a short independent session and release its connection immediately.
    with SessionLocal() as db:
        user = db.get(User, int(user_id)) if user_id.isdigit() else None
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        db.expunge(user)
        return user
