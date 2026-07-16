"""add asynchronous mission photo judgement fields

Revision ID: 20260716_0027
Revises: 20260715_0026
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260716_0027"
down_revision: Union[str, None] = "20260715_0026"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("mission_submissions", sa.Column("judge_status", sa.String(length=30), server_default="PENDING", nullable=False))
    op.add_column("mission_submissions", sa.Column("similarity_score", sa.Float(), nullable=True))
    op.add_column("mission_submissions", sa.Column("judge_reason", sa.Text(), nullable=True))
    op.add_column("mission_submissions", sa.Column("judge_model", sa.String(length=100), nullable=True))
    op.add_column("mission_submissions", sa.Column("judged_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("mission_submissions", sa.Column("judge_error", sa.Text(), nullable=True))
    op.create_index("ix_mission_submissions_judge_status", "mission_submissions", ["judge_status"])


def downgrade() -> None:
    op.drop_index("ix_mission_submissions_judge_status", table_name="mission_submissions")
    for column in ("judge_error", "judged_at", "judge_model", "judge_reason", "similarity_score", "judge_status"):
        op.drop_column("mission_submissions", column)
