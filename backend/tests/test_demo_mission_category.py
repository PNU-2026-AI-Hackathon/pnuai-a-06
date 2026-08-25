import unittest
import importlib.util
from pathlib import Path

from app.schemas.missions import Theme
from mission_admin.server import MISSION_THEME_PREFIXES


class DemoMissionCategoryTests(unittest.TestCase):
    def test_demo_is_supported_api_theme(self) -> None:
        self.assertEqual(Theme.DEMO.value, "DEMO")

    def test_demo_mission_code_prefix_is_separate(self) -> None:
        self.assertEqual(MISSION_THEME_PREFIXES["DEMO"], "DEMO")
        self.assertNotIn(
            MISSION_THEME_PREFIXES["DEMO"],
            {
                MISSION_THEME_PREFIXES["MOUNTAIN"],
                MISSION_THEME_PREFIXES["SEA"],
                MISSION_THEME_PREFIXES["CITY"],
            },
        )

    def test_all_demo_missions_have_bilingual_judgement_rules(self) -> None:
        migration_path = (
            Path(__file__).parents[1]
            / "alembic/versions/20260818_0039_seed_demo_mission_content.py"
        )
        spec = importlib.util.spec_from_file_location("demo_seed_migration", migration_path)
        self.assertIsNotNone(spec)
        self.assertIsNotNone(spec.loader)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        expected_codes = {f"DEMO_B{number:02d}" for number in range(1, 11)}
        self.assertEqual(set(module.DEMO_MISSIONS), expected_codes)
        self.assertEqual(set(module.RULES), expected_codes)
        self.assertEqual(set(module.ENGLISH_CONTENT), expected_codes)
        self.assertEqual(set(module.ENGLISH_RULES), expected_codes)

        for rules_by_locale in (module.RULES, module.ENGLISH_RULES):
            for rules in rules_by_locale.values():
                self.assertGreaterEqual(len(rules["required_elements"]), 3)
                self.assertGreaterEqual(len(rules["forbidden_elements"]), 3)
                self.assertEqual(sum(rules["weights"].values()), 1.0)


if __name__ == "__main__":
    unittest.main()
