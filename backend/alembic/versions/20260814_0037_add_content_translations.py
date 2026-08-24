"""add localized mission content and magazine locale

Revision ID: 20260814_0037
Revises: 20260813_0036
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260814_0037"
down_revision: Union[str, None] = "20260813_0036"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


MISSION_SET_TRANSLATIONS = {
    "MOUNTAIN": (
        "Mountain Basket",
        "Busan's Mountains and Forests",
        "Collect Busan's viewpoints, temples, forests, and old-school mountain vibes.",
    ),
    "SEA": (
        "Sea Basket",
        "Busan's Coast",
        "Discover activities, connections, and seafood along Busan's coast.",
    ),
    "CITY": (
        "City Basket",
        "Downtown Busan",
        "Enjoy markets, night views, parks, and street food across the city.",
    ),
}


# code: title, description, unlock condition, place, target keyword, reward item
MISSION_TRANSLATIONS = {
    "CITY_B01": ("Chameleon Challenge", "Match your outfit to the color of a market parasol and take a proof photo!", None, "Gupo Market", None, "Market Parasol"),
    "CITY_B02": ("Cyberpunk Busan", "Capture Busan's glowing high-rise skyline at night!", None, "Busan Harbor Bridge / Munhyeon Financial District", None, "Neon Building"),
    "CITY_B03": ("Meet Your Book", "Pick the book with the prettiest cover in the used-book alley and photograph it!", None, "Bosu-dong Book Street", None, ""),
    "CITY_B04": ("Cherry Blossom Picnic", "Capture cherry blossoms or lights reflected on the stream!", None, "Oncheoncheon Stream", None, ""),
    "CITY_R01": ("Busan Forest, Not Seoul Forest", "Spread out a picnic mat in one of Busan's wide-open parks and take a photo!", "Unlock after completing the basic City Basket missions", "Eulsukdo", None, "Picnic Mat"),
    "CITY_R02": ("Become One with the Mural", "Pose so your body naturally continues the artwork in an alley mural!", None, "Gamcheon Culture Village", None, ""),
    "CITY_S01": ("Multeok Pepero Game", "Bite down a shared fish-cake skewer until no more than 2 cm remains—without touching lips!", None, "Dongnae Market", None, "Multeok"),
    "CITY_S02": ("Seed Hotteok Close-up", "Take an extreme close-up of the seed-filled cross section!", None, "BIFF Square", None, ""),
    "CITY_S03": ("Pork Soup One-Shot", "Capture your face with a steaming earthenware bowl of pork soup!", None, "Seomyeon Pork Soup Alley", None, ""),
    "MTN_B01": ("Busan Is Mine Now", "Take a photo from a mountain viewpoint with Busan spread out below you!", None, "Hwangnyeongsan Beacon Mound", None, "Viewpoint"),
    "MTN_B02": ("Temple Stay", "Capture glowing lanterns at a temple—or shine a flashlight on your forehead if there are none!", None, "Samgwangsa Temple", None, "Lantern"),
    "MTN_B03": ("Cable Car Foot Shot", "Photograph the scenery passing beneath your feet from inside the cable car!", None, "Geumgang Park Cable Car", None, ""),
    "MTN_B04": ("Wildlife Sighting", "Photograph an animal you meet in the mountains, such as a squirrel, bird, or cat!", None, "Beomeosa Temple", None, ""),
    "MTN_B05": ("Walk Above the Clouds", "Capture the moment when fog or clouds settle below your feet halfway up the mountain!", None, "Geumjeongsanseong Fortress", None, ""),
    "MTN_R01": ("Phytoncide Healing", "Take a photo filled only with forest scenery, with no buildings in sight.", "Unlock after completing the basic Mountain Basket missions", "Baegyangsan Mountain", None, "Forest"),
    "MTN_S01": ("One More Cup, Please", "Wrap a white towel around your forehead and pose at an outdoor old-school eatery with a golden makgeolli cup!", None, "Geumjeongsanseong Fortress", None, "Makgeolli Cup"),
    "SEA_B01": ("Do You Like Surfing?", "Spot someone surfing in the sea and take a photo!", None, "Songjeong Beach", None, "Surfboard"),
    "SEA_B02": ("Just the Two of Us", "Hold hands by the sea and pose like a couple!", None, "Songdo Beach", None, "Holding Hands"),
    "SEA_B03": ("Seagull Ambush", "Take a dynamic shot with a flock of seagulls taking flight behind you!", None, "Jagalchi", None, ""),
    "SEA_R01": ("You Came to the Sea—Get Wet", "Go into the sea and prove that your clothes or body got wet!", "Unlock after completing the basic Sea Basket missions", "Dadaepo Beach", None, "Water Drops"),
    "SEA_R02": ("Coastal Cliffs", "Capture the grandeur of waves crashing against sea cliffs!", None, "Haedong Yonggungsa Temple", None, ""),
    "SEA_S01": ("A Gift for My Friend", "Hide wasabi in seafood for a friend and capture their surprised expression!", None, "Jagalchi Market", None, "Wasabi"),
    "SEA_S02": ("Shell Collector", "Collect three pretty shells or stones on the beach, place them on your palm, and take a photo!", None, "Dadaepo Beach", None, ""),
}


LOCATION_LABELS = {
    "CITY_B01": "Gupo Market",
    "CITY_B02": "Munhyeon Financial District",
    "CITY_B03": "Bosu-dong Book Street",
    "CITY_B04": "Oncheoncheon Stream",
    "CITY_R01": "Eulsukdo Park",
    "CITY_R02": "Gamcheon Culture Village",
    "CITY_S01": "Dongnae Market",
    "CITY_S02": "BIFF Square",
    "CITY_S03": "Seomyeon Pork Soup Alley",
    "MTN_B01": "Hwangnyeongsan Beacon Mound",
    "MTN_B02": "Samgwangsa Temple",
    "MTN_B03": "Geumgang Park Cable Car",
    "MTN_B04": "Beomeosa Temple",
    "MTN_B05": "Geumjeongsanseong Fortress",
    "MTN_R01": "Baegyangsan Mountain",
    "MTN_S01": "Geumjeongsanseong Fortress",
    "SEA_B01": "Songjeong Beach",
    "SEA_B02": "Songdo Beach",
    "SEA_B03": "Jagalchi",
    "SEA_R01": "Dadaepo Beach",
    "SEA_R02": "Haedong Yonggungsa Temple",
    "SEA_S01": "Jagalchi Market",
    "SEA_S02": "Dadaepo Beach",
}


def upgrade() -> None:
    op.create_table(
        "mission_set_translations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("mission_set_id", sa.Integer(), nullable=False),
        sa.Column("locale", sa.String(length=10), nullable=False),
        sa.Column("title", sa.String(length=100), nullable=True),
        sa.Column("region_label", sa.String(length=100), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["mission_set_id"], ["mission_sets.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("mission_set_id", "locale", name="uq_mission_set_translations_set_locale"),
    )
    op.create_index(op.f("ix_mission_set_translations_id"), "mission_set_translations", ["id"])
    op.create_index(op.f("ix_mission_set_translations_mission_set_id"), "mission_set_translations", ["mission_set_id"])
    op.create_index(op.f("ix_mission_set_translations_locale"), "mission_set_translations", ["locale"])

    op.create_table(
        "mission_translations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("mission_id", sa.Integer(), nullable=False),
        sa.Column("locale", sa.String(length=10), nullable=False),
        sa.Column("title", sa.String(length=120), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("unlock_condition", sa.Text(), nullable=True),
        sa.Column("place_label", sa.String(length=150), nullable=True),
        sa.Column("target_keyword", sa.String(length=100), nullable=True),
        sa.Column("judgement_rules", sa.JSON(), nullable=True),
        sa.Column("reward_item_name", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["mission_id"], ["missions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("mission_id", "locale", name="uq_mission_translations_mission_locale"),
    )
    op.create_index(op.f("ix_mission_translations_id"), "mission_translations", ["id"])
    op.create_index(op.f("ix_mission_translations_mission_id"), "mission_translations", ["mission_id"])
    op.create_index(op.f("ix_mission_translations_locale"), "mission_translations", ["locale"])

    op.create_table(
        "mission_location_translations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("mission_location_id", sa.Integer(), nullable=False),
        sa.Column("locale", sa.String(length=10), nullable=False),
        sa.Column("label", sa.String(length=150), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["mission_location_id"], ["mission_locations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("mission_location_id", "locale", name="uq_mission_location_translations_location_locale"),
    )
    op.create_index(op.f("ix_mission_location_translations_id"), "mission_location_translations", ["id"])
    op.create_index(op.f("ix_mission_location_translations_mission_location_id"), "mission_location_translations", ["mission_location_id"])
    op.create_index(op.f("ix_mission_location_translations_locale"), "mission_location_translations", ["locale"])

    op.add_column(
        "schedule_magazines",
        sa.Column("locale", sa.String(length=10), server_default="ko", nullable=False),
    )
    op.drop_constraint(
        "uq_schedule_magazines_schedule_template", "schedule_magazines", type_="unique"
    )
    op.create_unique_constraint(
        "uq_schedule_magazines_schedule_template_locale",
        "schedule_magazines",
        ["schedule_id", "template_key", "locale"],
    )

    connection = op.get_bind()
    for theme, (title, region_label, description) in MISSION_SET_TRANSLATIONS.items():
        connection.execute(
            sa.text(
                """
                INSERT INTO mission_set_translations
                    (mission_set_id, locale, title, region_label, description)
                SELECT id, 'en', :title, :region_label, :description
                FROM mission_sets WHERE theme = :theme
                ON CONFLICT (mission_set_id, locale) DO NOTHING
                """
            ),
            {"theme": theme, "title": title, "region_label": region_label, "description": description},
        )
    for code, values in MISSION_TRANSLATIONS.items():
        title, description, unlock_condition, place_label, target_keyword, reward_item_name = values
        connection.execute(
            sa.text(
                """
                INSERT INTO mission_translations
                    (mission_id, locale, title, description, unlock_condition,
                     place_label, target_keyword, reward_item_name)
                SELECT id, 'en', :title, :description, :unlock_condition,
                       :place_label, :target_keyword, :reward_item_name
                FROM missions WHERE code = :code
                ON CONFLICT (mission_id, locale) DO NOTHING
                """
            ),
            {
                "code": code,
                "title": title,
                "description": description,
                "unlock_condition": unlock_condition,
                "place_label": place_label,
                "target_keyword": target_keyword,
                "reward_item_name": reward_item_name,
            },
        )
    for code, label in LOCATION_LABELS.items():
        connection.execute(
            sa.text(
                """
                INSERT INTO mission_location_translations
                    (mission_location_id, locale, label)
                SELECT ml.id, 'en', :label
                FROM mission_locations AS ml
                JOIN missions AS m ON m.id = ml.mission_id
                WHERE m.code = :code
                ON CONFLICT (mission_location_id, locale) DO NOTHING
                """
            ),
            {"code": code, "label": label},
        )


def downgrade() -> None:
    op.drop_constraint(
        "uq_schedule_magazines_schedule_template_locale",
        "schedule_magazines",
        type_="unique",
    )
    op.execute("DELETE FROM schedule_magazines WHERE locale <> 'ko'")
    op.create_unique_constraint(
        "uq_schedule_magazines_schedule_template",
        "schedule_magazines",
        ["schedule_id", "template_key"],
    )
    op.drop_column("schedule_magazines", "locale")

    op.drop_index(op.f("ix_mission_location_translations_locale"), table_name="mission_location_translations")
    op.drop_index(op.f("ix_mission_location_translations_mission_location_id"), table_name="mission_location_translations")
    op.drop_index(op.f("ix_mission_location_translations_id"), table_name="mission_location_translations")
    op.drop_table("mission_location_translations")
    op.drop_index(op.f("ix_mission_translations_locale"), table_name="mission_translations")
    op.drop_index(op.f("ix_mission_translations_mission_id"), table_name="mission_translations")
    op.drop_index(op.f("ix_mission_translations_id"), table_name="mission_translations")
    op.drop_table("mission_translations")
    op.drop_index(op.f("ix_mission_set_translations_locale"), table_name="mission_set_translations")
    op.drop_index(op.f("ix_mission_set_translations_mission_set_id"), table_name="mission_set_translations")
    op.drop_index(op.f("ix_mission_set_translations_id"), table_name="mission_set_translations")
    op.drop_table("mission_set_translations")
