"""add district fields to missions

Revision ID: 20260702_0004
Revises: 20260702_0003
Create Date: 2026-07-02
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260702_0004"
down_revision: Union[str, None] = "20260702_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("mission_sets", sa.Column("district_code", sa.String(length=50), nullable=True))
    op.add_column("mission_sets", sa.Column("district_label", sa.String(length=100), nullable=True))
    op.add_column("missions", sa.Column("district_code", sa.String(length=50), nullable=True))
    op.add_column("missions", sa.Column("district_label", sa.String(length=100), nullable=True))

    op.execute(
        """
        UPDATE mission_sets
        SET district_code = CASE theme
            WHEN 'MOUNTAIN' THEN 'SAHA_SEO'
            WHEN 'SEA' THEN 'YEONGDO'
            WHEN 'CITY' THEN 'JUNG'
        END,
        district_label = CASE theme
            WHEN 'MOUNTAIN' THEN '사하구·서구'
            WHEN 'SEA' THEN '영도구'
            WHEN 'CITY' THEN '중구'
        END
        """
    )
    op.execute(
        """
        UPDATE missions
        SET district_code = CASE
            WHEN type = 'SIDE' THEN 'ALL_BUSAN'
            WHEN theme = 'MOUNTAIN' THEN 'SAHA_SEO'
            WHEN theme = 'SEA' THEN 'YEONGDO'
            WHEN theme = 'CITY' THEN 'JUNG'
        END,
        district_label = CASE
            WHEN type = 'SIDE' THEN '부산 전역'
            WHEN theme = 'MOUNTAIN' THEN '사하구·서구'
            WHEN theme = 'SEA' THEN '영도구'
            WHEN theme = 'CITY' THEN '중구'
        END
        """
    )

    op.alter_column("mission_sets", "district_code", nullable=False)
    op.alter_column("mission_sets", "district_label", nullable=False)
    op.alter_column("missions", "district_code", nullable=False)
    op.alter_column("missions", "district_label", nullable=False)
    op.create_index(op.f("ix_mission_sets_district_code"), "mission_sets", ["district_code"], unique=False)
    op.create_index(op.f("ix_missions_district_code"), "missions", ["district_code"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_missions_district_code"), table_name="missions")
    op.drop_index(op.f("ix_mission_sets_district_code"), table_name="mission_sets")
    op.drop_column("missions", "district_label")
    op.drop_column("missions", "district_code")
    op.drop_column("mission_sets", "district_label")
    op.drop_column("mission_sets", "district_code")
