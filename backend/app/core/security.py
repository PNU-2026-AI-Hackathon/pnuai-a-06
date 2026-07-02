import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Literal

from jose import JWTError, jwt

from app.core.config import get_settings

PASSWORD_HASH_ITERATIONS = 210_000
TokenType = Literal["access", "refresh"]


def create_token(*, subject: str, token_type: TokenType, expires_delta: timedelta) -> str:
    settings = get_settings()
    expires_at = datetime.now(timezone.utc) + expires_delta
    payload = {"sub": subject, "typ": token_type, "exp": expires_at}
    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def create_access_token(subject: str) -> str:
    settings = get_settings()
    return create_token(
        subject=subject,
        token_type="access",
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )


def create_refresh_token(subject: str) -> str:
    settings = get_settings()
    return create_token(
        subject=subject,
        token_type="refresh",
        expires_delta=timedelta(days=settings.refresh_token_expire_days),
    )


def decode_token(token: str, expected_type: TokenType) -> str | None:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
    except JWTError:
        return None

    if payload.get("typ") != expected_type:
        return None

    subject = payload.get("sub")
    if subject is None:
        return None
    return str(subject)


def decode_access_token(token: str) -> str | None:
    return decode_token(token, "access")


def decode_refresh_token(token: str) -> str | None:
    return decode_token(token, "refresh")


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        PASSWORD_HASH_ITERATIONS,
    ).hex()
    return f"pbkdf2_sha256${PASSWORD_HASH_ITERATIONS}${salt}${digest}"


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False

    try:
        algorithm, iterations, salt, expected_digest = password_hash.split("$", 3)
    except ValueError:
        return False

    if algorithm != "pbkdf2_sha256":
        return False

    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        int(iterations),
    ).hex()
    return hmac.compare_digest(digest, expected_digest)


def hash_verification_code(code: str) -> str:
    settings = get_settings()
    return hmac.new(
        settings.jwt_secret_key.encode("utf-8"),
        code.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def verify_code(code: str, code_hash: str | None) -> bool:
    if not code_hash:
        return False
    return hmac.compare_digest(hash_verification_code(code), code_hash)
