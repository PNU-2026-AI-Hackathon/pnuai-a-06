"""limit each session member to one submission vote

Revision ID: 20260713_0022
Revises: 20260713_0021
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260713_0022"
down_revision: Union[str, None] = "20260713_0021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("mission_submission_likes", sa.Column("session_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_mission_submission_likes_session_id",
        "mission_submission_likes",
        "mission_sessions",
        ["session_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.execute(
        sa.text(
            "UPDATE mission_submission_likes l "
            "SET session_id = s.session_id "
            "FROM mission_submissions s "
            "WHERE l.submission_id = s.id"
        )
    )
    op.alter_column("mission_submission_likes", "session_id", nullable=False)
    op.execute(
        sa.text(
            "DELETE FROM mission_submission_likes older "
            "USING mission_submission_likes newer "
            "WHERE older.session_id = newer.session_id "
            "AND older.user_id = newer.user_id "
            "AND older.id > newer.id"
        )
    )
    op.drop_constraint(
        "uq_mission_submission_likes_submission_user",
        "mission_submission_likes",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_mission_submission_likes_session_user",
        "mission_submission_likes",
        ["session_id", "user_id"],
    )
    op.create_index("ix_mission_submission_likes_session_id", "mission_submission_likes", ["session_id"])


def downgrade() -> None:
    op.drop_index("ix_mission_submission_likes_session_id", table_name="mission_submission_likes")
    op.drop_constraint(
        "uq_mission_submission_likes_session_user",
        "mission_submission_likes",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_mission_submission_likes_submission_user",
        "mission_submission_likes",
        ["submission_id", "user_id"],
    )
    op.drop_constraint(
        "fk_mission_submission_likes_session_id",
        "mission_submission_likes",
        type_="foreignkey",
    )
    op.drop_column("mission_submission_likes", "session_id")
