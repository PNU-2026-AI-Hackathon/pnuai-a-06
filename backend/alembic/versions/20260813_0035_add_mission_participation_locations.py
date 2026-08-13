"""add mission participation locations

Revision ID: 20260813_0035
Revises: 20260812_0034
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260813_0035"
down_revision: Union[str, None] = "20260812_0034"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "mission_locations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("mission_id", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=150), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column(
            "allowed_radius_m",
            sa.Integer(),
            server_default="300",
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
            name="ck_mission_locations_latitude",
        ),
        sa.CheckConstraint(
            "longitude >= -180 AND longitude <= 180",
            name="ck_mission_locations_longitude",
        ),
        sa.CheckConstraint(
            "allowed_radius_m > 0",
            name="ck_mission_locations_allowed_radius",
        ),
        sa.ForeignKeyConstraint(["mission_id"], ["missions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_mission_locations_id"), "mission_locations", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_mission_locations_mission_id"),
        "mission_locations",
        ["mission_id"],
        unique=False,
    )

    op.add_column(
        "mission_session_members",
        sa.Column(
            "location_check_status",
            sa.String(length=30),
            server_default="NOT_CHECKED",
            nullable=False,
        ),
    )
    op.add_column(
        "mission_session_members",
        sa.Column("location_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "mission_session_members",
        sa.Column("location_latitude", sa.Float(), nullable=True),
    )
    op.add_column(
        "mission_session_members",
        sa.Column("location_longitude", sa.Float(), nullable=True),
    )
    op.add_column(
        "mission_session_members",
        sa.Column("location_accuracy_m", sa.Float(), nullable=True),
    )
    op.add_column(
        "mission_session_members",
        sa.Column("location_distance_m", sa.Float(), nullable=True),
    )
    op.add_column(
        "mission_session_members",
        sa.Column("location_measured_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "mission_session_members",
        sa.Column("location_checked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        op.f("ix_mission_session_members_location_check_status"),
        "mission_session_members",
        ["location_check_status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_mission_session_members_location_id"),
        "mission_session_members",
        ["location_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_mission_session_members_location_id",
        "mission_session_members",
        "mission_locations",
        ["location_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_mission_session_members_location_id",
        "mission_session_members",
        type_="foreignkey",
    )
    op.drop_index(
        op.f("ix_mission_session_members_location_id"),
        table_name="mission_session_members",
    )
    op.drop_index(
        op.f("ix_mission_session_members_location_check_status"),
        table_name="mission_session_members",
    )
    op.drop_column("mission_session_members", "location_checked_at")
    op.drop_column("mission_session_members", "location_measured_at")
    op.drop_column("mission_session_members", "location_distance_m")
    op.drop_column("mission_session_members", "location_accuracy_m")
    op.drop_column("mission_session_members", "location_longitude")
    op.drop_column("mission_session_members", "location_latitude")
    op.drop_column("mission_session_members", "location_id")
    op.drop_column("mission_session_members", "location_check_status")

    op.drop_index(op.f("ix_mission_locations_mission_id"), table_name="mission_locations")
    op.drop_index(op.f("ix_mission_locations_id"), table_name="mission_locations")
    op.drop_table("mission_locations")
