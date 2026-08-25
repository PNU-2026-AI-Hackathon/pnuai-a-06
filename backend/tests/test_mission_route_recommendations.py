from datetime import date
import unittest
from unittest.mock import patch

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.models.missions import Mission, MissionLocation, MissionSet
from app.models.schedules import MissionSchedule, ScheduleMission
from app.models.users import User
from app.services.mission_route_recommendations import (
    MissionRouteRecommendationError,
    _validate_recommended_order,
    recommend_schedule_mission_order,
)
from app.services.localization import localized_schedule_mission

# Register every model, but skip the PostgreSQL sequence-backed magazine table
# when creating the isolated SQLite schema.
import app.models.magazines  # noqa: E402,F401


class MissionRouteRecommendationTest(unittest.TestCase):
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
            provider_user_id="route-creator@example.com",
            email="route-creator@example.com",
            nickname="Creator",
        )
        outsider = User(
            provider="EMAIL",
            provider_user_id="route-outsider@example.com",
            email="route-outsider@example.com",
            nickname="Outsider",
        )
        mission_set = MissionSet(
            theme="SEA",
            title="바다",
            region_label="부산 바다",
        )
        missions = []
        for index, (district, place, latitude, longitude) in enumerate(
            [
                ("해운대구", "송정", 35.178, 129.199),
                ("서구", "송도", 35.076, 129.017),
                ("사하구", "다대포", 35.047, 128.966),
            ],
            start=1,
        ):
            mission = Mission(
                mission_set=mission_set,
                code=f"ROUTE_B{index:02d}",
                theme="SEA",
                district_code=f"DISTRICT_{index}",
                district_label=district,
                place_label=place,
                address=f"부산광역시 {district} 테스트로 {index}",
                type="BASIC",
                title=f"경로 미션 {index}",
                description="날짜별 방문 순서 추천 테스트",
                verification_type="GPS_PHOTO",
                reward_item_name="테스트 보상",
                reward_item_icon="",
            )
            mission.locations.append(
                MissionLocation(
                    label=place,
                    latitude=latitude,
                    longitude=longitude,
                    allowed_radius_m=300,
                )
            )
            missions.append(mission)

        schedule = MissionSchedule(
            creator=creator,
            title="부산 여행",
            start_date=date(2026, 8, 24),
            end_date=date(2026, 8, 25),
        )
        first = ScheduleMission(
            schedule=schedule,
            mission=missions[0],
            added_by=creator,
            planned_date=date(2026, 8, 24),
            visit_order=1,
        )
        second = ScheduleMission(
            schedule=schedule,
            mission=missions[1],
            added_by=creator,
            planned_date=date(2026, 8, 24),
            visit_order=2,
        )
        other_day = ScheduleMission(
            schedule=schedule,
            mission=missions[2],
            added_by=creator,
            planned_date=date(2026, 8, 25),
            visit_order=1,
        )
        self.db.add_all([creator, outsider, schedule])
        self.db.commit()

        self.creator_id = creator.id
        self.outsider_id = outsider.id
        self.schedule_id = schedule.id
        self.first_id = first.id
        self.second_id = second.id
        self.other_day_id = other_day.id
        self.db.expunge_all()

    def _stored_orders(self):
        rows = self.db.execute(
            select(
                ScheduleMission.id,
                ScheduleMission.planned_date,
                ScheduleMission.visit_order,
            ).order_by(ScheduleMission.id)
        ).all()
        return {row.id: (row.planned_date, row.visit_order) for row in rows}

    @patch(
        "app.services.mission_route_recommendations._request_recommended_order"
    )
    def test_recommendation_persists_only_requested_date(self, request_order):
        request_order.return_value = [self.second_id, self.first_id]

        result = recommend_schedule_mission_order(
            self.db,
            schedule_id=self.schedule_id,
            creator_id=self.creator_id,
            planned_date=date(2026, 8, 24),
        )

        self.assertEqual([mission.id for mission in result], [self.second_id, self.first_id])
        self.assertEqual([mission.visit_order for mission in result], [1, 2])
        localized = localized_schedule_mission(result[0], "ko")
        self.assertEqual(localized.visit_order, 1)
        stored = self._stored_orders()
        self.assertEqual(stored[self.first_id], (date(2026, 8, 24), 2))
        self.assertEqual(stored[self.second_id], (date(2026, 8, 24), 1))
        self.assertEqual(stored[self.other_day_id], (date(2026, 8, 25), 1))

        candidates = request_order.call_args.args[0]
        self.assertEqual(
            [candidate["schedule_mission_id"] for candidate in candidates],
            [self.first_id, self.second_id],
        )
        self.assertTrue(all(candidate["locations"] for candidate in candidates))

    @patch(
        "app.services.mission_route_recommendations._request_recommended_order"
    )
    def test_invalid_recommendation_never_mutates_database(self, request_order):
        before = self._stored_orders()
        request_order.return_value = [self.first_id, self.first_id]

        with self.assertRaises(MissionRouteRecommendationError) as raised:
            recommend_schedule_mission_order(
                self.db,
                schedule_id=self.schedule_id,
                creator_id=self.creator_id,
                planned_date=date(2026, 8, 24),
            )

        self.assertEqual(raised.exception.code, "ROUTE_RECOMMENDATION_UNAVAILABLE")
        self.assertEqual(self._stored_orders(), before)

    @patch(
        "app.services.mission_route_recommendations._request_recommended_order"
    )
    def test_non_creator_cannot_request_or_mutate_order(self, request_order):
        before = self._stored_orders()

        with self.assertRaises(MissionRouteRecommendationError) as raised:
            recommend_schedule_mission_order(
                self.db,
                schedule_id=self.schedule_id,
                creator_id=self.outsider_id,
                planned_date=date(2026, 8, 24),
            )

        self.assertEqual(raised.exception.code, "SCHEDULE_NOT_FOUND")
        request_order.assert_not_called()
        self.assertEqual(self._stored_orders(), before)

    @patch(
        "app.services.mission_route_recommendations._request_recommended_order"
    )
    def test_single_mission_day_does_not_call_openai(self, request_order):
        result = recommend_schedule_mission_order(
            self.db,
            schedule_id=self.schedule_id,
            creator_id=self.creator_id,
            planned_date=date(2026, 8, 25),
        )

        request_order.assert_not_called()
        self.assertEqual([mission.id for mission in result], [self.other_day_id])
        self.assertEqual(result[0].visit_order, 1)

    def test_validator_rejects_missing_duplicate_and_unknown_ids(self):
        for ordered_ids in ([1], [1, 1], [1, 3]):
            with self.subTest(ordered_ids=ordered_ids):
                with self.assertRaises(ValueError):
                    _validate_recommended_order(
                        {"ordered_schedule_mission_ids": ordered_ids},
                        [1, 2],
                    )


if __name__ == "__main__":
    unittest.main()
