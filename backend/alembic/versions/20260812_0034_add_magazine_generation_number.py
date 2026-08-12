"""add global magazine generation number

Revision ID: 20260812_0034
Revises: 20260812_0033
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260812_0034"
down_revision: Union[str, None] = "20260812_0033"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE SEQUENCE magazine_generation_number_seq START WITH 1")
    op.add_column(
        "schedule_magazines",
        sa.Column(
            "generation_number",
            sa.Integer(),
            server_default=sa.text("nextval('magazine_generation_number_seq')"),
            nullable=False,
        ),
    )
    op.create_unique_constraint(
        "uq_schedule_magazines_generation_number",
        "schedule_magazines",
        ["generation_number"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_schedule_magazines_generation_number",
        "schedule_magazines",
        type_="unique",
    )
    op.drop_column("schedule_magazines", "generation_number")
    op.execute("DROP SEQUENCE magazine_generation_number_seq")
