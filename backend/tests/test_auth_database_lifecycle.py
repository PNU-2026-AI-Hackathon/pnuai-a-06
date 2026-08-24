import unittest
from unittest.mock import MagicMock, patch

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.auth.dependencies import get_current_user
from app.models.users import User
from app.services.users import update_user_profile


class AuthDatabaseLifecycleTest(unittest.TestCase):
    @patch("app.auth.dependencies.decode_access_token", return_value="42")
    @patch("app.auth.dependencies.SessionLocal")
    def test_authentication_releases_its_session_before_return(
        self,
        session_factory,
        _decode_access_token,
    ):
        user = User(
            id=42,
            provider="email",
            provider_user_id="user@example.com",
            email="user@example.com",
        )
        session = MagicMock()
        session.get.return_value = user
        session_factory.return_value.__enter__.return_value = session

        result = get_current_user(token="valid-token")

        self.assertIs(result, user)
        session.get.assert_called_once_with(User, 42)
        session.expunge.assert_called_once_with(user)
        session_factory.return_value.__exit__.assert_called_once()

    def test_detached_authenticated_user_can_still_be_updated(self):
        engine = create_engine(
            "sqlite+pysqlite://",
            poolclass=StaticPool,
        )
        User.__table__.create(engine)
        with Session(engine) as auth_db:
            user = User(
                provider="email",
                provider_user_id="detached@example.com",
                email="detached@example.com",
                nickname="Before",
            )
            auth_db.add(user)
            auth_db.commit()
            user_id = user.id
            auth_db.expunge(user)

        with Session(engine) as route_db:
            updated = update_user_profile(
                route_db,
                user,
                nickname="After",
                update_nickname=True,
            )
            self.assertEqual(updated.nickname, "After")

        with Session(engine) as verify_db:
            self.assertEqual(verify_db.get(User, user_id).nickname, "After")
        engine.dispose()


if __name__ == "__main__":
    unittest.main()
