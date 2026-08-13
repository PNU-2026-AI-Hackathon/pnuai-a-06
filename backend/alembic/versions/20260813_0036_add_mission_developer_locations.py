"""add mission developer locations

Revision ID: 20260813_0036
Revises: 20260813_0035
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260813_0036"
down_revision: Union[str, None] = "20260813_0035"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "mission_developer_locations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=150), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column(
            "allowed_radius_m",
            sa.Integer(),
            server_default="300",
            nullable=False,
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "latitude >= -90 AND latitude <= 90",
            name="ck_mission_developer_locations_latitude",
        ),
        sa.CheckConstraint(
            "longitude >= -180 AND longitude <= 180",
            name="ck_mission_developer_locations_longitude",
        ),
        sa.CheckConstraint(
            "allowed_radius_m > 0",
            name="ck_mission_developer_locations_allowed_radius",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_mission_developer_locations_id"),
        "mission_developer_locations",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_mission_developer_locations_is_active"),
        "mission_developer_locations",
        ["is_active"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_mission_developer_locations_is_active"),
        table_name="mission_developer_locations",
    )
    op.drop_index(
        op.f("ix_mission_developer_locations_id"),
        table_name="mission_developer_locations",
    )
    op.drop_table("mission_developer_locations")
