"""mvp schema

Revision ID: 0002_schema
Revises: 0001_init
Create Date: 2026-10-19

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0002_schema"
down_revision = "0001_init"
branch_labels = None
depends_on = None


def upgrade() -> None:
    user_role = postgresql.ENUM(
        "patient", "dermatologist", "admin", name="user_role"
    )
    appointment_status = postgresql.ENUM(
        "pending", "confirmed", "cancelled", "completed", name="appointment_status"
    )
    body_side = postgresql.ENUM("front", "back", name="body_side")
    user_role.create(op.get_bind(), checkfirst=True)
    appointment_status.create(op.get_bind(), checkfirst=True)
    body_side.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", postgresql.ENUM(name="user_role", create_type=False), nullable=False),
        sa.Column("first_name", sa.String(length=100), nullable=False),
        sa.Column("last_name", sa.String(length=100), nullable=False),
        sa.Column("phone", sa.String(length=30), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_table(
        "patient_profiles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("birth_date", sa.Date(), nullable=True),
        sa.UniqueConstraint("user_id", name="uq_patient_profiles_user_id"),
    )
    op.create_table(
        "doctor_profiles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("specialization", sa.String(length=120), nullable=False),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.UniqueConstraint("user_id", name="uq_doctor_profiles_user_id"),
    )
    op.create_table(
        "working_hours",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("doctor_id", sa.Integer(), sa.ForeignKey("doctor_profiles.id"), nullable=False),
        sa.Column("weekday", sa.Integer(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
    )
    op.create_table(
        "services",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("price", sa.Numeric(10, 2), nullable=False),
    )
    op.create_table(
        "appointments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("patient_id", sa.Integer(), sa.ForeignKey("patient_profiles.id"), nullable=False),
        sa.Column("doctor_id", sa.Integer(), sa.ForeignKey("doctor_profiles.id"), nullable=False),
        sa.Column("service_id", sa.Integer(), sa.ForeignKey("services.id"), nullable=False),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "status",
            postgresql.ENUM(name="appointment_status", create_type=False),
            nullable=False,
        ),
        sa.Column("notes", sa.Text(), nullable=True),
    )
    op.create_index(
        "ix_appointments_doctor_id_start_at",
        "appointments",
        ["doctor_id", "start_at"],
    )
    op.create_table(
        "skin_findings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("patient_id", sa.Integer(), sa.ForeignKey("patient_profiles.id"), nullable=False),
        sa.Column("appointment_id", sa.Integer(), sa.ForeignKey("appointments.id"), nullable=True),
        sa.Column("side", postgresql.ENUM(name="body_side", create_type=False), nullable=False),
        sa.Column("geometry", postgresql.JSONB(), nullable=False),
        sa.Column("color", sa.String(length=30), nullable=False),
        sa.Column("finding_type", sa.String(length=80), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "finding_photos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("finding_id", sa.Integer(), sa.ForeignKey("skin_findings.id"), nullable=False),
        sa.Column("path", sa.String(length=500), nullable=False),
        sa.Column("mime", sa.String(length=100), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("finding_photos")
    op.drop_table("skin_findings")
    op.drop_index("ix_appointments_doctor_id_start_at", table_name="appointments")
    op.drop_table("appointments")
    op.drop_table("services")
    op.drop_table("working_hours")
    op.drop_table("doctor_profiles")
    op.drop_table("patient_profiles")
    op.drop_table("users")
    postgresql.ENUM(name="body_side").drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(name="appointment_status").drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(name="user_role").drop(op.get_bind(), checkfirst=True)
