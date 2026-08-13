from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
import unittest

from pydantic import ValidationError

from app.schemas.mission_sessions import MissionParticipationRequest
from app.services.mission_sessions import (
    MissionLocationValidationError,
    _check_participation_location,
    _distance_m,
)
from mission_admin.server import _validated_location_values
from fastapi import HTTPException


class FakeSession:
    def __init__(self, verification_type: str, locations: list[SimpleNamespace]):
        mission = SimpleNamespace(
            verification_type=verification_type,
            locations=locations,
        )
        self.schedule_mission = SimpleNamespace(mission=mission)


class FakeDatabase:
    def __init__(self, developer_locations: list[SimpleNamespace] | None = None):
        self.commit_count = 0
        self.developer_locations = developer_locations or []

    def scalars(self, _statement):
        values = self.developer_locations

        class Result:
            def all(self):
                return values

        return Result()

    def commit(self) -> None:
        self.commit_count += 1


def make_member() -> SimpleNamespace:
    return SimpleNamespace(
        participation_status="UNDECIDED",
        decision_at=None,
        ready_at=None,
        excluded_at=None,
        exclusion_reason=None,
        upload_deadline_at=None,
    )


class MissionLocationTest(unittest.TestCase):
    def test_distance_is_zero_for_same_coordinate(self):
        self.assertEqual(_distance_m(35.1796, 129.0756, 35.1796, 129.0756), 0)

    def test_configured_gps_location_passes_inside_radius(self):
        target = SimpleNamespace(
            id=7,
            latitude=35.1796,
            longitude=129.0756,
            allowed_radius_m=100,
        )
        member = make_member()

        _check_participation_location(
            FakeDatabase(),
            FakeSession("GPS_PHOTO", [target]),
            member,
            latitude=35.1796,
            longitude=129.0756,
            accuracy_m=10,
            measured_at=datetime.now(timezone.utc),
        )

        self.assertEqual(member.location_check_status, "PASSED")
        self.assertEqual(member.location_id, target.id)
        self.assertEqual(member.location_distance_m, 0)

    def test_configured_gps_location_rejects_outside_radius(self):
        target = SimpleNamespace(
            id=8,
            latitude=35.1796,
            longitude=129.0756,
            allowed_radius_m=100,
        )
        database = FakeDatabase()
        member = make_member()

        with self.assertRaises(MissionLocationValidationError) as raised:
            _check_participation_location(
                database,
                FakeSession("GPS_PHOTO", [target]),
                member,
                latitude=35.1896,
                longitude=129.0756,
                accuracy_m=10,
                measured_at=datetime.now(timezone.utc),
            )

        self.assertEqual(raised.exception.code, "MISSION_LOCATION_OUT_OF_RANGE")
        self.assertEqual(member.location_check_status, "FAILED")
        self.assertEqual(member.participation_status, "UNDECIDED")
        self.assertEqual(database.commit_count, 1)

    def test_unconfigured_gps_location_temporarily_allows_participation(self):
        member = make_member()

        _check_participation_location(
            FakeDatabase(),
            FakeSession("GPS_PHOTO", []),
            member,
            latitude=None,
            longitude=None,
            accuracy_m=None,
            measured_at=None,
        )

        self.assertEqual(member.location_check_status, "NOT_CONFIGURED")

    def test_active_developer_location_applies_to_every_gps_mission(self):
        developer_location = SimpleNamespace(
            id=99,
            latitude=35.1796,
            longitude=129.0756,
            allowed_radius_m=300,
            is_active=True,
        )
        member = make_member()

        _check_participation_location(
            FakeDatabase([developer_location]),
            FakeSession("GPS_PHOTO", []),
            member,
            latitude=35.1796,
            longitude=129.0756,
            accuracy_m=10,
            measured_at=datetime.now(timezone.utc),
        )

        self.assertEqual(member.location_check_status, "PASSED")
        self.assertIsNone(member.location_id)
        self.assertEqual(member.location_distance_m, 0)

    def test_any_containing_location_passes_even_if_nearest_radius_is_too_small(self):
        narrow_mission_location = SimpleNamespace(
            id=10,
            latitude=35.1796,
            longitude=129.0756,
            allowed_radius_m=10,
        )
        broad_developer_location = SimpleNamespace(
            id=100,
            latitude=35.1806,
            longitude=129.0756,
            allowed_radius_m=300,
            is_active=True,
        )
        member = make_member()

        _check_participation_location(
            FakeDatabase([broad_developer_location]),
            FakeSession("GPS_PHOTO", [narrow_mission_location]),
            member,
            latitude=35.1798,
            longitude=129.0756,
            accuracy_m=10,
            measured_at=datetime.now(timezone.utc),
        )

        self.assertEqual(member.location_check_status, "PASSED")
        self.assertIsNone(member.location_id)

    def test_stale_location_is_rejected(self):
        target = SimpleNamespace(
            id=9,
            latitude=35.1796,
            longitude=129.0756,
            allowed_radius_m=100,
        )

        with self.assertRaises(MissionLocationValidationError) as raised:
            _check_participation_location(
                FakeDatabase(),
                FakeSession("GPS_PHOTO", [target]),
                make_member(),
                latitude=35.1796,
                longitude=129.0756,
                accuracy_m=10,
                measured_at=datetime.now(timezone.utc) - timedelta(minutes=5),
            )

        self.assertEqual(raised.exception.code, "MISSION_LOCATION_STALE")

    def test_partial_location_payload_is_rejected(self):
        with self.assertRaises(ValidationError):
            MissionParticipationRequest(
                decision="PARTICIPATE",
                latitude=35.1796,
            )

    def test_admin_location_values_validate_coordinate_bounds(self):
        self.assertEqual(
            _validated_location_values(35.1796, 129.0756, 300),
            (35.1796, 129.0756, 300),
        )
        with self.assertRaises(HTTPException):
            _validated_location_values(91, 129.0756, 300)
        with self.assertRaises(HTTPException):
            _validated_location_values(35.1796, 181, 300)
        with self.assertRaises(HTTPException):
            _validated_location_values(35.1796, 129.0756, 0)


if __name__ == "__main__":
    unittest.main()
