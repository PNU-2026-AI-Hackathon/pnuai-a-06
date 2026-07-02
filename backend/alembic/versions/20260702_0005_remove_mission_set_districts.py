"""remove district fields from mission sets

Revision ID: 20260702_0005
Revises: 20260702_0004
Create Date: 2026-07-02
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260702_0005"
down_revision: Union[str, None] = "20260702_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index(op.f("ix_mission_sets_district_code"), table_name="mission_sets")
    op.drop_column("mission_sets", "district_label")
    op.drop_column("mission_sets", "district_code")


def downgrade() -> None:
    op.add_column("mission_sets", sa.Column("district_code", sa.String(length=50), nullable=True))
    op.add_column("mission_sets", sa.Column("district_label", sa.String(length=100), nullable=True))
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
    op.alter_column("mission_sets", "district_code", nullable=False)
    op.alter_column("mission_sets", "district_label", nullable=False)
    op.create_index(op.f("ix_mission_sets_district_code"), "mission_sets", ["district_code"], unique=False)
