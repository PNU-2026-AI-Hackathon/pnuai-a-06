"""shorten English mission copy for compact frontend layouts

Revision ID: 20260820_0040
Revises: 20260818_0039
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260820_0040"
down_revision: Union[str, None] = "20260818_0039"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# code: old title, old description, short title, short description
COPY_UPDATES = {
    "CITY_B01": (
        "Chameleon Challenge",
        "Match your outfit to the color of a market parasol and take a proof photo!",
        "Chameleon Challenge",
        "Match your outfit to a market parasol and take a photo.",
    ),
    "CITY_B03": (
        "Meet Your Book",
        "Pick the book with the prettiest cover in the used-book alley and photograph it!",
        "Meet Your Book",
        "Photograph the prettiest book cover in the alley.",
    ),
    "CITY_R01": (
        "Busan Forest, Not Seoul Forest",
        "Spread out a picnic mat in one of Busan's wide-open parks and take a photo!",
        "Busan Park Picnic",
        "Spread out a picnic mat in a spacious Busan park.",
    ),
    "CITY_R02": (
        "Become One with the Mural",
        "Pose so your body naturally continues the artwork in an alley mural!",
        "Become the Mural",
        "Pose so your body continues the alley mural.",
    ),
    "CITY_S01": (
        "Multeok Pepero Game",
        "Bite down a shared fish-cake skewer until no more than 2 cm remains—without touching lips!",
        "Multeok Pepero Game",
        "Share a fish-cake skewer until only 2 cm remains—no lips!",
    ),
    "CITY_S03": (
        "Pork Soup One-Shot",
        "Capture your face with a steaming earthenware bowl of pork soup!",
        "Pork Soup One-Shot",
        "Pose with a steaming bowl of pork soup.",
    ),
    "MTN_B01": (
        "Busan Is Mine Now",
        "Take a photo from a mountain viewpoint with Busan spread out below you!",
        "Busan Is Mine Now",
        "Take a photo with Busan spread out below you.",
    ),
    "MTN_B02": (
        "Temple Stay",
        "Capture glowing lanterns at a temple—or shine a flashlight on your forehead if there are none!",
        "Temple Stay",
        "Photograph temple lanterns—or pose with a forehead light.",
    ),
    "MTN_B03": (
        "Cable Car Foot Shot",
        "Photograph the scenery passing beneath your feet from inside the cable car!",
        "Cable Car Foot Shot",
        "Photograph the view beneath your feet from the cable car.",
    ),
    "MTN_B04": (
        "Wildlife Sighting",
        "Photograph an animal you meet in the mountains, such as a squirrel, bird, or cat!",
        "Wildlife Sighting",
        "Photograph an animal you meet in the mountains.",
    ),
    "MTN_B05": (
        "Walk Above the Clouds",
        "Capture the moment when fog or clouds settle below your feet halfway up the mountain!",
        "Walk Above the Clouds",
        "Photograph fog or clouds below your feet on the mountain.",
    ),
    "MTN_R01": (
        "Phytoncide Healing",
        "Take a photo filled only with forest scenery, with no buildings in sight.",
        "Phytoncide Healing",
        "Take a forest-only photo with no buildings in sight.",
    ),
    "MTN_S01": (
        "One More Cup, Please",
        "Wrap a white towel around your forehead and pose at an outdoor old-school eatery with a golden makgeolli cup!",
        "One More Cup, Please",
        "Wear a white head towel and pose with a makgeolli cup.",
    ),
    "SEA_B03": (
        "Seagull Ambush",
        "Take a dynamic shot with a flock of seagulls taking flight behind you!",
        "Seagull Ambush",
        "Photograph seagulls taking flight behind you.",
    ),
    "SEA_R01": (
        "You Came to the Sea—Get Wet",
        "Go into the sea and prove that your clothes or body got wet!",
        "Get Soaked at Sea",
        "Go into the sea and prove that your clothes or body got wet!",
    ),
    "SEA_S01": (
        "A Gift for My Friend",
        "Hide wasabi in seafood for a friend and capture their surprised expression!",
        "A Gift for My Friend",
        "Hide wasabi in seafood and capture your friend's reaction.",
    ),
    "SEA_S02": (
        "Shell Collector",
        "Collect three pretty shells or stones on the beach, place them on your palm, and take a photo!",
        "Shell Collector",
        "Hold three pretty shells or stones in your palm for a photo.",
    ),
    "DEMO_B01": (
        "Make the Busan Sea",
        "Fill the frame with blue objects—such as pens, tumblers, or clothing—to represent Gwangalli's blue sea.",
        "Make the Busan Sea",
        "Fill the frame with blue objects to create Busan's sea.",
    ),
    "DEMO_B03": (
        "Busan Seagull Sing-Along",
        "Everyone in the frame should open their mouth wide and look like they are singing together.",
        "Busan Seagull Sing-Along",
        "Pose together with mouths open as if singing.",
    ),
    "DEMO_B04": (
        "Human Wave",
        "Capture two or three people linking their arms to create a wave motion.",
        "Human Wave",
        "Link arms with 2–3 people and make a wave.",
    ),
    "DEMO_B05": (
        "Slicing Sashimi",
        "Mime slicing sashimi with one flat hand in a karate-chop gesture.",
        "Slicing Sashimi",
        "Mime slicing sashimi with a flat karate-chop hand.",
    ),
    "DEMO_B07": (
        "Gwangan Bridge Arch",
        "Two people join hands above their heads to form a bridge-like arch.",
        "Gwangan Bridge Arch",
        "Join hands overhead to form a bridge arch.",
    ),
    "DEMO_B08": (
        "Camellia Heart",
        "Place a red object inside a hand heart to represent Busan's camellia.",
        "Camellia Heart",
        "Put a red object inside a hand heart.",
    ),
    "DEMO_B09": (
        "Hey! We're Friends!",
        "Hold an open palm toward the camera with a surprised expression.",
        "Hey! We're Friends!",
        "Show an open palm and a surprised face.",
    ),
    "DEMO_B10": (
        "Jagalchi Ajimae, Fighting!",
        "Clench both fists, raise them, and strike an energetic fighting pose.",
        "Jagalchi Fighting!",
        "Raise both fists in an energetic fighting pose.",
    ),
}


def _apply_copy(*, use_short_copy: bool) -> None:
    connection = op.get_bind()
    statement = sa.text(
        """
        UPDATE mission_translations AS translation
        SET title = :title,
            description = :description
        FROM missions AS mission
        WHERE translation.mission_id = mission.id
          AND translation.locale = 'en'
          AND mission.code = :code
        """
    )

    for code, (old_title, old_description, short_title, short_description) in COPY_UPDATES.items():
        connection.execute(
            statement,
            {
                "code": code,
                "title": short_title if use_short_copy else old_title,
                "description": short_description if use_short_copy else old_description,
            },
        )


def upgrade() -> None:
    _apply_copy(use_short_copy=True)


def downgrade() -> None:
    _apply_copy(use_short_copy=False)
