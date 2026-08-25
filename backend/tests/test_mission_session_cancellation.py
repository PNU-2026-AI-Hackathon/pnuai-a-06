import asyncio
from datetime import date, datetime, timedelta, timezone
import unittest
from unittest.mock import AsyncMock, patch

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.models.missions import Mission, MissionSet
from app.models.schedules import (
    MissionSchedule,
    MissionSession,
    MissionSessionMember,
    ScheduleMember,
    ScheduleMission,
)
from app.models.users import User
from app.routers.mission_sessions import cancel_mission_session
from app.services.mission_sessions import (
    cancel_session,
    create_session,
    get_active_session_for_schedule,
    get_session_for_user,
)

# Register every model, excluding only the PostgreSQL sequence-backed magazine
# table when creating the isolated SQLite schema.
import app.models.magazines  # noqa: E402,F401


class MissionSessionCancellationTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite+pysqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        tables = [
            table
            for name, table in Base.metadata.tables.items()
            if name != "schedule_magazines"
        ]
        Base.metadata.create_all(self.engine, tables=tables)
        self.db = Session(self.engine)
        self._seed_data()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def _seed_data(self):
        creator = User(
            provider="EMAIL",
            provider_user_id="cancel-creator@example.com",
            email="cancel-creator@example.com",
            nickname="Creator",
        )
        companion = User(
            provider="EMAIL",
            provider_user_id="cancel-companion@example.com",
            email="cancel-companion@example.com",
            nickname="Companion",
        )
        outsider = User(
            provider="EMAIL",
            provider_user_id="cancel-outsider@example.com",
            email="cancel-outsider@example.com",
            nickname="Outsider",
        )
        mission_set = MissionSet(theme="CITY", title="도시", region_label="부산 도심")
        mission = Mission(
            mission_set=mission_set,
            code="CANCEL_B01",
            theme="CITY",
            district_code="JUNG",
            district_label="중구",
            place_label="테스트 장소",
            type="BASIC",
            title="취소 테스트",
            description="세션 취소를 검증합니다.",
            verification_type="PHOTO",
            reward_item_name="",
            reward_item_icon="",
        )
        schedule = MissionSchedule(
            creator=creator,
            title="취소 테스트 일정",
            start_date=date(2026, 8, 24),
            end_date=date(2026, 8, 25),
        )
        schedule.members.append(
            ScheduleMember(
                user=companion,
                invited_by=creator,
                status="ACCEPTED",
                invite_email=companion.email,
                invite_token="cancel-test-invite",
                invite_token_expires_at=datetime.now(timezone.utc)
                + timedelta(days=1),
            )
        )
        schedule_mission = ScheduleMission(
            schedule=schedule,
            mission=mission,
            added_by=creator,
        )
        session = MissionSession(
            schedule_mission=schedule_mission,
            created_by=creator,
            status="READY",
        )
        session.members.extend(
            [
                MissionSessionMember(
                    user=creator,
                    participation_status="PARTICIPATING",
                    upload_deadline_at=datetime.now(timezone.utc)
                    + timedelta(minutes=1),
                ),
                MissionSessionMember(
                    user=companion,
                    participation_status="UNDECIDED",
                ),
            ]
        )
        self.db.add_all([creator, companion, outsider, schedule])
        self.db.commit()
        self.creator = creator
        self.creator_id = creator.id
        self.companion_id = companion.id
        self.outsider_id = outsider.id
        self.schedule_id = schedule.id
        self.schedule_mission_id = schedule_mission.id
        self.session_id = session.id
        self.db.expunge_all()

    def test_creator_cancellation_is_global_and_retry_creates_a_new_session(self):
        self.assertIsNone(
            cancel_session(self.db, self.session_id, self.outsider_id)
        )

        cancelled = cancel_session(self.db, self.session_id, self.creator_id)

        self.assertIsNotNone(cancelled)
        self.assertEqual(cancelled.status, "CANCELLED")
        self.assertIsNotNone(cancelled.completed_at)
        self.assertTrue(all(member.upload_deadline_at is None for member in cancelled.members))

        companion_view = get_session_for_user(
            self.db, self.session_id, self.companion_id
        )
        self.assertEqual(companion_view.status, "CANCELLED")
        self.assertIsNone(
            get_active_session_for_schedule(
                self.db, self.schedule_id, self.companion_id
            )
        )

        replacement = create_session(
            self.db,
            self.schedule_id,
            self.schedule_mission_id,
            self.creator_id,
        )
        self.assertIsNotNone(replacement)
        self.assertNotEqual(replacement.id, self.session_id)
        self.assertEqual(replacement.status, "WAITING")
        active = get_active_session_for_schedule(
            self.db, self.schedule_id, self.companion_id
        )
        self.assertEqual(active.id, replacement.id)

    def test_cancel_endpoint_broadcasts_to_session_and_schedule_sockets(self):
        creator = self.db.get(User, self.creator_id)
        with patch(
            "app.routers.mission_sessions.mission_session_ws.broadcast_session",
            new=AsyncMock(),
        ) as session_broadcast, patch(
            "app.routers.mission_sessions.schedule_mission_ws.broadcast_session",
            new=AsyncMock(),
        ) as schedule_broadcast:
            response = asyncio.run(
                cancel_mission_session(
                    self.session_id,
                    locale="ko",
                    current_user=creator,
                    db=self.db,
                )
            )

        self.assertEqual(response.status.value, "CANCELLED")
        session_broadcast.assert_awaited_once()
        schedule_broadcast.assert_awaited_once()
        self.assertEqual(session_broadcast.await_args.args[1], "session_cancelled")
        self.assertEqual(schedule_broadcast.await_args.args[2], "session_cancelled")

    def test_cancelled_session_remains_cancelled_on_repeated_request(self):
        first = cancel_session(self.db, self.session_id, self.creator_id)
        completed_at = first.completed_at
        second = cancel_session(self.db, self.session_id, self.creator_id)

        stored_status = self.db.scalar(
            select(MissionSession.status).where(MissionSession.id == self.session_id)
        )
        self.assertEqual(second.status, "CANCELLED")
        self.assertEqual(second.completed_at, completed_at)
        self.assertEqual(stored_status, "CANCELLED")


if __name__ == "__main__":
    unittest.main()
