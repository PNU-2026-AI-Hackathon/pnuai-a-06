import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from app.core.security import hash_password, verify_code, verify_password
from app.models.users import User
from app.services.users import (
    EmailAccountNotRegisteredError,
    EmailAccountNotVerifiedError,
    MAX_PASSWORD_RESET_ATTEMPTS,
    request_email_password_reset,
    reset_email_password,
)


class FakeSession:
    def __init__(self, user: User | None):
        self.user = user
        self.commit_count = 0

    def scalar(self, _statement):
        return self.user

    def commit(self):
        self.commit_count += 1

    def refresh(self, _user):
        return None


def make_email_user(*, verified: bool = True) -> User:
    now = datetime.now(timezone.utc)
    return User(
        id=1,
        provider="email",
        provider_user_id="user@example.com",
        email="user@example.com",
        nickname="User",
        password_hash=hash_password("old-password"),
        email_verified_at=now if verified else None,
        password_reset_attempts=0,
    )


class PasswordResetTest(unittest.TestCase):
    def test_unknown_email_must_register_first(self):
        db = FakeSession(None)

        with self.assertRaises(EmailAccountNotRegisteredError):
            request_email_password_reset(
                db,
                email="missing@example.com",
                expires_in_minutes=10,
            )

        self.assertEqual(db.commit_count, 0)

    def test_unverified_signup_must_finish_verification(self):
        db = FakeSession(make_email_user(verified=False))

        with self.assertRaises(EmailAccountNotVerifiedError):
            request_email_password_reset(
                db,
                email="user@example.com",
                expires_in_minutes=10,
            )

        self.assertEqual(db.commit_count, 0)

    def test_request_and_confirm_reset_password(self):
        user = make_email_user()
        db = FakeSession(user)

        with patch(
            "app.services.users.create_email_verification_code",
            return_value="123456",
        ):
            _, code = request_email_password_reset(
                db,
                email="user@example.com",
                expires_in_minutes=10,
            )

        self.assertEqual(code, "123456")
        self.assertTrue(verify_code(code, user.password_reset_code_hash))
        self.assertGreater(user.password_reset_expires_at, datetime.now(timezone.utc))

        result = reset_email_password(
            db,
            email="user@example.com",
            code=code,
            new_password="new-password",
        )

        self.assertIs(result, user)
        self.assertTrue(verify_password("new-password", user.password_hash))
        self.assertFalse(verify_password("old-password", user.password_hash))
        self.assertIsNone(user.password_reset_code_hash)
        self.assertIsNone(user.password_reset_expires_at)
        self.assertEqual(user.password_reset_attempts, 0)

    def test_five_wrong_codes_invalidate_reset(self):
        user = make_email_user()
        user.password_reset_code_hash = "invalid-hash"
        user.password_reset_expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
        db = FakeSession(user)

        for _ in range(MAX_PASSWORD_RESET_ATTEMPTS):
            result = reset_email_password(
                db,
                email="user@example.com",
                code="999999",
                new_password="new-password",
            )
            self.assertIsNone(result)

        self.assertIsNone(user.password_reset_code_hash)
        self.assertIsNone(user.password_reset_expires_at)
        self.assertEqual(user.password_reset_attempts, 0)
        self.assertTrue(verify_password("old-password", user.password_hash))


if __name__ == "__main__":
    unittest.main()
