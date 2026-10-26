"""user consent timestamp

Revision ID: 0006_user_consent
Revises: 0005_appointment_reminders
Create Date: 2026-10-26

"""

import sqlalchemy as sa
from alembic import op

revision = "0006_user_consent"
down_revision = "0005_appointment_reminders"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("consent_at", sa.DateTime(timezone=True), nullable=True),
    )
    # Istniejący (demonstracyjni) użytkownicy dostają datę migracji jako datę zgody.
    op.execute("UPDATE users SET consent_at = now() WHERE consent_at IS NULL")


def downgrade() -> None:
    op.drop_column("users", "consent_at")
