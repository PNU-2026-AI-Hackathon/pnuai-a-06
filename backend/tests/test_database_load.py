import asyncio
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
import unittest
from unittest.mock import patch

from fastapi import Request
from sqlalchemy import create_engine, event
from sqlalchemy.exc import TimeoutError as SQLAlchemyTimeoutError
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.main import database_pool_timeout_handler
from app.models.missions import (
    Mission,
    MissionLocation,
    MissionLocationTranslation,
    MissionSet,
    MissionTranslation,
)
from app.models.schedules import (
    MissionSchedule,
    MissionSession,
    MissionSessionMember,
    MissionSubmission,
    MissionSubmissionComment,
    MissionSubmissionLike,
    ScheduleMember,
    ScheduleMission,
)
from app.models.users import User
from app.services.localization import localized_schedule, localized_session
from app.services.mission_sessions import (
    get_active_session_for_schedule,
    get_latest_session_for_schedule_mission,
    get_session_for_user,
)
from app.services.schedules import list_user_schedules

# Register the magazine model without creating its PostgreSQL sequence-backed
# table in SQLite. All other model tables are safe for this query-count test.
import app.models.magazines  # noqa: E402,F401


@contextmanager
def count_selects(engine):
    statements = []

    def before_cursor_execute(
        _connection,
        _cursor,
        statement,
        _parameters,
        _context,
        _executemany,
    ):
        if statement.lstrip().upper().startswith("SELECT"):
            statements.append(statement)

    event.listen(engine, "before_cursor_execute", before_cursor_execute)
    try:
        yield statements
    finally:
        event.remove(engine, "before_cursor_execute", before_cursor_execute)


class DatabaseLoadTest(unittest.TestCase):
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
            provider_user_id="creator@example.com",
            email="creator@example.com",
            nickname="Creator",
        )
        companion = User(
            provider="EMAIL",
            provider_user_id="companion@example.com",
            email="companion@example.com",
            nickname="Companion",
        )
        mission_set = MissionSet(
            theme="SEA",
            title="바다",
            region_label="부산 바다",
        )
        mission = Mission(
            mission_set=mission_set,
            code="LOAD_B01",
            theme="SEA",
            district_code="HAEUNDAE",
            district_label="해운대구",
            place_label="송정",
            type="BASIC",
            title="부하 테스트 미션",
            description="쿼리 개수를 검증합니다.",
            verification_type="PHOTO",
            reward_item_name="테스트 보상",
            reward_item_icon="",
        )
        mission.translations.append(
            MissionTranslation(
                locale="en",
                title="Load Test Mission",
                description="Verify the bounded query count.",
                place_label="Songjeong Beach",
            )
        )
        location = MissionLocation(
            label="송정해수욕장",
            latitude=35.178,
            longitude=129.199,
            allowed_radius_m=300,
        )
        location.translations.append(
            MissionLocationTranslation(locale="en", label="Songjeong Beach")
        )
        mission.locations.append(location)

        schedule = MissionSchedule(
            creator=creator,
            title="테스트 일정",
            start_date=date(2026, 8, 20),
            end_date=date(2026, 8, 21),
        )
        schedule.members.append(
            ScheduleMember(
                user=companion,
                invited_by=creator,
                status="ACCEPTED",
                invite_email=companion.email,
                invite_token="load-test-invite",
                invite_token_expires_at=datetime.now(timezone.utc)
                + timedelta(days=1),
            )
        )
        schedule_mission = ScheduleMission(
            schedule=schedule,
            mission=mission,
            added_by=creator,
            status="COMPLETED",
        )
        session = MissionSession(
            schedule_mission=schedule_mission,
            created_by=creator,
            status="COMPLETED",
            completed_at=datetime.now(timezone.utc),
        )
        session.members.extend(
            [
                MissionSessionMember(
                    user=creator,
                    participation_status="COMPLETED",
                    location_check_status="NOT_REQUIRED",
                ),
                MissionSessionMember(
                    user=companion,
                    participation_status="COMPLETED",
                    location_check_status="NOT_REQUIRED",
                ),
            ]
        )
        submission = MissionSubmission(
            user=creator,
            storage_key="static/test.jpg",
            photo_url="/static/test.jpg",
            judge_status="PASSED",
        )
        session.submissions.append(submission)
        self.db.add_all([creator, companion, schedule])
        self.db.flush()
        submission.comments.append(
            MissionSubmissionComment(
                user=companion,
                content="좋아요!",
            )
        )
        submission.likes.append(
            MissionSubmissionLike(
                session_id=session.id,
                user=companion,
            )
        )
        self.db.commit()
        self.creator_id = creator.id
        self.companion_id = companion.id
        self.schedule_id = schedule.id
        self.schedule_mission_id = schedule_mission.id
        self.session_id = session.id
        self.db.expunge_all()

    def test_schedule_list_has_bounded_queries_and_serializes_detached(self):
        with count_selects(self.engine) as statements:
            schedules = list_user_schedules(self.db, self.creator_id)

        self.assertEqual(len(schedules), 1)
        self.assertLessEqual(len(statements), 4)
        self.db.expunge_all()
        response = localized_schedule(schedules[0], "en")
        self.assertEqual(response.missions[0].mission.title, "Load Test Mission")
        self.assertEqual(
            response.missions[0].mission.locations[0].label,
            "Songjeong Beach",
        )

    def test_session_reads_have_bounded_queries_and_accepted_member_access(self):
        with count_selects(self.engine) as statements:
            session = get_session_for_user(
                self.db,
                self.session_id,
                self.companion_id,
            )

        self.assertIsNotNone(session)
        self.assertLessEqual(len(statements), 3)
        self.db.expunge_all()
        response = localized_session(session, "en")
        self.assertEqual(response.mission.title, "Load Test Mission")
        self.assertEqual(response.submissions[0].like_count, 1)
        self.assertEqual(response.submissions[0].comments[0].content, "좋아요!")

    def test_latest_and_empty_active_session_queries_are_bounded(self):
        with count_selects(self.engine) as latest_statements:
            latest = get_latest_session_for_schedule_mission(
                self.db,
                self.schedule_id,
                self.schedule_mission_id,
                self.companion_id,
            )
        self.assertIsNotNone(latest)
        self.assertLessEqual(len(latest_statements), 3)

        self.db.expunge_all()
        with count_selects(self.engine) as active_statements:
            active = get_active_session_for_schedule(
                self.db,
                self.schedule_id,
                self.companion_id,
            )
        self.assertIsNone(active)
        self.assertEqual(len(active_statements), 1)


class DatabaseBusyResponseTest(unittest.TestCase):
    def test_pool_timeout_returns_retryable_503(self):
        request = Request(
            {
                "type": "http",
                "http_version": "1.1",
                "method": "GET",
                "scheme": "http",
                "path": "/schedules",
                "raw_path": b"/schedules",
                "query_string": b"",
                "headers": [],
                "client": ("127.0.0.1", 12345),
                "server": ("127.0.0.1", 7020),
                "root_path": "",
            }
        )
        with patch("app.main.logger.error") as log_error:
            response = asyncio.run(
                database_pool_timeout_handler(
                    request,
                    SQLAlchemyTimeoutError("pool exhausted"),
                )
            )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.headers["retry-after"], "1")
        self.assertIn(b'"code":"DATABASE_BUSY"', response.body)
        log_error.assert_called_once()


if __name__ == "__main__":
    unittest.main()
