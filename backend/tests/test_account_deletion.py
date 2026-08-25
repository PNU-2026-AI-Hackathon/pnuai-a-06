import unittest
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException

from app.auth.router import delete_me
from app.core.config import Settings
from app.models.users import User


class FakeSession:
    def __init__(self):
        self.deleted = []
        self.commit_count = 0

    def delete(self, user):
        self.deleted.append(user)

    def commit(self):
        self.commit_count += 1


def make_user(*, provider: str, provider_user_id: str) -> User:
    return User(
        id=1,
        provider=provider,
        provider_user_id=provider_user_id,
        nickname="User",
    )


class AccountDeletionTest(unittest.IsolatedAsyncioTestCase):
    async def test_email_account_is_deleted_locally(self):
        user = make_user(provider="email", provider_user_id="user@example.com")
        db = FakeSession()

        response = await delete_me(
            current_user=user,
            db=db,
            settings=Settings(KAKAO_ADMIN_KEY=""),
        )

        self.assertEqual(response.status_code, 204)
        self.assertEqual(db.deleted, [user])
        self.assertEqual(db.commit_count, 1)

    async def test_kakao_account_requires_admin_key(self):
        user = make_user(provider="kakao", provider_user_id="12345")
        db = FakeSession()

        with self.assertRaises(HTTPException) as raised:
            await delete_me(
                current_user=user,
                db=db,
                settings=Settings(KAKAO_ADMIN_KEY=""),
            )

        self.assertEqual(raised.exception.status_code, 503)
        self.assertEqual(
            raised.exception.detail["code"],
            "KAKAO_UNLINK_NOT_CONFIGURED",
        )
        self.assertEqual(db.deleted, [])
        self.assertEqual(db.commit_count, 0)

    @patch(
        "app.auth.router.unlink_kakao_user_with_admin_key",
        new_callable=AsyncMock,
    )
    async def test_kakao_account_is_unlinked_before_local_delete(self, unlink):
        user = make_user(provider="kakao", provider_user_id="12345")
        db = FakeSession()

        response = await delete_me(
            current_user=user,
            db=db,
            settings=Settings(KAKAO_ADMIN_KEY="admin-key"),
        )

        self.assertEqual(response.status_code, 204)
        unlink.assert_awaited_once_with(
            kakao_id="12345",
            admin_key="admin-key",
        )
        self.assertEqual(db.deleted, [user])
        self.assertEqual(db.commit_count, 1)

    @patch(
        "app.auth.router.unlink_kakao_user_with_admin_key",
        new_callable=AsyncMock,
    )
    async def test_failed_kakao_unlink_keeps_local_account(self, unlink):
        unlink.side_effect = HTTPException(
            status_code=502,
            detail={"code": "KAKAO_UNLINK_FAILED"},
        )
        user = make_user(provider="kakao", provider_user_id="12345")
        db = FakeSession()

        with self.assertRaises(HTTPException):
            await delete_me(
                current_user=user,
                db=db,
                settings=Settings(KAKAO_ADMIN_KEY="admin-key"),
            )

        self.assertEqual(db.deleted, [])
        self.assertEqual(db.commit_count, 0)


if __name__ == "__main__":
    unittest.main()
