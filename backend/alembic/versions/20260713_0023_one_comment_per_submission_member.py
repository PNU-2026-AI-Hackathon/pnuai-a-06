"""allow one comment per member per submission

Revision ID: 20260713_0023
Revises: 20260713_0022
"""
from typing import Sequence, Union

from alembic import op


revision: str = "20260713_0023"
down_revision: Union[str, None] = "20260713_0022"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_mission_submission_comments_submission_user",
        "mission_submission_comments",
        ["submission_id", "user_id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_mission_submission_comments_submission_user",
        "mission_submission_comments",
        type_="unique",
    )
