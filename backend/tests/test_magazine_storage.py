from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import Mock, patch

from sqlalchemy import UniqueConstraint

from app.models.magazines import ScheduleMagazine
from app.services.magazine_renderer import MagazineTemplate, render_magazine
from app.services.magazines import get_generated_magazine


class MagazineStorageTest(unittest.TestCase):
    def test_magazine_identity_does_not_include_locale(self):
        unique_columns = {
            tuple(column.name for column in constraint.columns)
            for constraint in ScheduleMagazine.__table__.constraints
            if isinstance(constraint, UniqueConstraint)
        }

        self.assertIn(("schedule_id", "template_key"), unique_columns)
        self.assertNotIn(("schedule_id", "template_key", "locale"), unique_columns)

    @patch("app.services.magazines._load_accessible_schedule", return_value=object())
    def test_generated_magazine_lookup_ignores_requested_locale(self, _mock_access):
        expected = object()
        db = Mock()
        db.scalar.return_value = expected

        result = get_generated_magazine(
            db,
            schedule_id=146,
            user_id=33,
            template_key="handwriting-2025-v1",
            locale="en",
        )

        self.assertIs(result, expected)
        statement = db.scalar.call_args.args[0]
        where_sql = str(statement).split("WHERE", 1)[1]
        self.assertNotIn("schedule_magazines.locale", where_sql)

    def test_new_render_path_is_shared_across_locales(self):
        template = MagazineTemplate(
            key="test-frame",
            name="Test",
            names={},
            version=1,
            width=360,
            height=2112,
            render_scale=1,
            capacity=6,
            font="font.ttf",
            accent="#409CB7",
            svg_path=Path("frame.svg"),
            photo_slots=[],
            content_slots=[],
            comment_slots=[],
            comment_icon_slots=[],
        )
        source = {"locale": "en", "pages": [{"id": 1}]}

        with TemporaryDirectory() as directory:
            output_dir = Path(directory)

            def create_output(_template, _source, _pages, output_path):
                output_path.touch()

            with (
                patch("app.services.magazine_renderer.OUTPUT_DIR", output_dir),
                patch(
                    "app.services.magazine_renderer._render_one",
                    side_effect=create_output,
                ),
            ):
                urls = render_magazine(template, source, schedule_id=146)

        self.assertEqual(urls, ["/static/magazines/146/test-frame/page-1.webp"])


if __name__ == "__main__":
    unittest.main()
