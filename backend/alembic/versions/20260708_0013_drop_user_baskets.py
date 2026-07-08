"""drop user baskets

Revision ID: 20260708_0013
Revises: 20260708_0012
Create Date: 2026-07-08
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260708_0013"
down_revision: Union[str, None] = "20260708_0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index(op.f("ix_baskets_user_id"), table_name="baskets")
    op.drop_index(op.f("ix_baskets_theme"), table_name="baskets")
    op.drop_index(op.f("ix_baskets_id"), table_name="baskets")
    op.drop_table("baskets")


def downgrade() -> None:
    op.create_table(
        "baskets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("theme", sa.String(length=30), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
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
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "theme", name="uq_baskets_user_theme"),
    )
    op.create_index(op.f("ix_baskets_id"), "baskets", ["id"], unique=False)
    op.create_index(op.f("ix_baskets_theme"), "baskets", ["theme"], unique=False)
    op.create_index(op.f("ix_baskets_user_id"), "baskets", ["user_id"], unique=False)
