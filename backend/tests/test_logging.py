import logging
import unittest

from app.main import SensitiveQueryFilter


class SensitiveQueryFilterTest(unittest.TestCase):
    def test_websocket_token_is_redacted_from_format_argument(self):
        record = logging.LogRecord(
            name="uvicorn.error",
            level=logging.INFO,
            pathname=__file__,
            lineno=1,
            msg='WebSocket %s [accepted]',
            args=("/schedules/1/mission-sessions/ws?token=secret.jwt.value",),
            exc_info=None,
        )

        SensitiveQueryFilter().filter(record)

        self.assertNotIn("secret.jwt.value", record.getMessage())
        self.assertIn("token=[REDACTED]", record.getMessage())

    def test_access_token_is_redacted_without_removing_other_query_values(self):
        record = logging.LogRecord(
            name="uvicorn.error",
            level=logging.INFO,
            pathname=__file__,
            lineno=1,
            msg="/ws?room=3&access_token=secret-value&mode=live",
            args=(),
            exc_info=None,
        )

        SensitiveQueryFilter().filter(record)

        self.assertEqual(
            record.getMessage(),
            "/ws?room=3&access_token=[REDACTED]&mode=live",
        )


if __name__ == "__main__":
    unittest.main()
