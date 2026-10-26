"""medical reports

Revision ID: 0003_medical_reports
Revises: 0002_schema
Create Date: 2026-10-23

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0003_medical_reports"
down_revision = "0002_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    body_figure = postgresql.ENUM("male", "female", name="body_figure")
    body_figure.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "medical_reports",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("patient_id", sa.Integer(), sa.ForeignKey("patient_profiles.id"), nullable=False),
        sa.Column("doctor_id", sa.Integer(), sa.ForeignKey("doctor_profiles.id"), nullable=True),
        sa.Column(
            "body_figure",
            postgresql.ENUM(name="body_figure", create_type=False),
            nullable=False,
            server_default="male",
        ),
        sa.Column("notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(
        "ix_medical_reports_patient_id_created_at",
        "medical_reports",
        ["patient_id", "created_at"],
    )

    op.add_column(
        "skin_findings",
        sa.Column(
            "report_id",
            sa.Integer(),
            sa.ForeignKey("medical_reports.id", ondelete="CASCADE"),
            nullable=True,
        ),
    )
    op.create_index("ix_skin_findings_report_id", "skin_findings", ["report_id"])


def downgrade() -> None:
    op.drop_index("ix_skin_findings_report_id", table_name="skin_findings")
    op.drop_column("skin_findings", "report_id")
    op.drop_index("ix_medical_reports_patient_id_created_at", table_name="medical_reports")
    op.drop_table("medical_reports")
    postgresql.ENUM(name="body_figure").drop(op.get_bind(), checkfirst=True)
