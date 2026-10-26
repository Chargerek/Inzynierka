"""report photos

Revision ID: 0004_report_photos
Revises: 0003_medical_reports
Create Date: 2026-10-26

"""

import sqlalchemy as sa
from alembic import op

revision = "0004_report_photos"
down_revision = "0003_medical_reports"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "report_photos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "report_id",
            sa.Integer(),
            sa.ForeignKey("medical_reports.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("path", sa.String(length=500), nullable=False),
        sa.Column("mime", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_report_photos_report_id", "report_photos", ["report_id"])


def downgrade() -> None:
    op.drop_index("ix_report_photos_report_id", table_name="report_photos")
    op.drop_table("report_photos")
