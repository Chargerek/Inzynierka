"""appointment reminder timestamp

Revision ID: 0005_appointment_reminders
Revises: 0004_report_photos
Create Date: 2026-10-26

"""

import sqlalchemy as sa
from alembic import op

revision = "0005_appointment_reminders"
down_revision = "0004_report_photos"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "appointments",
        sa.Column("reminder_sent_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("appointments", "reminder_sent_at")
