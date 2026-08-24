"""add separate demo mission category

Revision ID: 20260818_0038
Revises: 20260814_0037
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260818_0038"
down_revision: Union[str, None] = "20260814_0037"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    connection = op.get_bind()
    connection.execute(
        sa.text(
            """
            SELECT setval(
                pg_get_serial_sequence('mission_sets', 'id'),
                COALESCE((SELECT MAX(id) FROM mission_sets), 0) + 1,
                false
            )
            """
        )
    )
    connection.execute(
        sa.text(
            """
            INSERT INTO mission_sets
                (theme, title, region_label, description, sort_order)
            VALUES
                ('DEMO', '시연용 미션', '시연 전용',
                 '산·바다·도시 바구니와 분리해 운영하는 시연용 미션 모음입니다.', 100)
            ON CONFLICT (theme) DO NOTHING
            """
        )
    )
    connection.execute(
        sa.text(
            """
            INSERT INTO mission_set_translations
                (mission_set_id, locale, title, region_label, description)
            SELECT id, 'en', 'Demo Missions', 'Demo Only',
                   'Presentation missions managed separately from the Mountain, Sea, and City baskets.'
            FROM mission_sets
            WHERE theme = 'DEMO'
            ON CONFLICT (mission_set_id, locale) DO NOTHING
            """
        )
    )


def downgrade() -> None:
    op.execute("DELETE FROM mission_sets WHERE theme = 'DEMO'")
