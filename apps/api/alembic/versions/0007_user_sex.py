"""user sex column

Revision ID: 0007_user_sex
Revises: 0006_user_consent
Create Date: 2026-10-28

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0007_user_sex"
down_revision = "0006_user_consent"
branch_labels = None
depends_on = None

user_sex = postgresql.ENUM("male", "female", name="user_sex")


def upgrade() -> None:
    user_sex.create(op.get_bind(), checkfirst=True)
    op.add_column("users", sa.Column("sex", user_sex, nullable=True))


def downgrade() -> None:
    op.drop_column("users", "sex")
    user_sex.drop(op.get_bind(), checkfirst=True)
