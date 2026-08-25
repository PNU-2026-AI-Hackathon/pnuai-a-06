"""unify generated magazines across locales

Revision ID: 20260825_0045
Revises: 20260824_0044
Create Date: 2026-08-25
"""

from collections.abc import Sequence

from alembic import op


revision: str = "20260825_0045"
down_revision: str | None = "20260824_0044"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Prefer the newest successfully generated image. If no READY record
    # exists, retain the newest attempt so its failure state remains visible.
    op.execute(
        """
        WITH ranked AS (
            SELECT
                id,
                ROW_NUMBER() OVER (
                    PARTITION BY schedule_id, template_key
                    ORDER BY
                        CASE WHEN status = 'READY' THEN 0 ELSE 1 END,
                        generation_number DESC,
                        updated_at DESC,
                        id DESC
                ) AS row_number
            FROM schedule_magazines
        )
        DELETE FROM schedule_magazines AS magazine
        USING ranked
        WHERE magazine.id = ranked.id
          AND ranked.row_number > 1
        """
    )
    op.drop_constraint(
        "uq_schedule_magazines_schedule_template_locale",
        "schedule_magazines",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_schedule_magazines_schedule_template",
        "schedule_magazines",
        ["schedule_id", "template_key"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_schedule_magazines_schedule_template",
        "schedule_magazines",
        type_="unique",
    )
    op.create_unique_constraint(
        "uq_schedule_magazines_schedule_template_locale",
        "schedule_magazines",
        ["schedule_id", "template_key", "locale"],
    )
