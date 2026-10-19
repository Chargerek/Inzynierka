from datetime import date, time

from sqlalchemy import select

from app.core.passwords import hash_password
from app.db.session import SessionLocal
from app.models import DoctorProfile, PatientProfile, Service, User, UserRole, WorkingHours

DEMO_PASSWORD = "Demo123!"

USERS = [
    {
        "email": "admin@gabinet.local",
        "role": UserRole.ADMIN,
        "first_name": "Administrator",
        "last_name": "Gabinetu",
    },
    {
        "email": "lekarz@gabinet.local",
        "role": UserRole.DERMATOLOGIST,
        "first_name": "Anna",
        "last_name": "Kowalska",
        "phone": "500100200",
    },
    {
        "email": "jan.nowak@gabinet.local",
        "role": UserRole.PATIENT,
        "first_name": "Jan",
        "last_name": "Nowak",
        "birth_date": date(1990, 4, 12),
    },
    {
        "email": "maria.wisniewska@gabinet.local",
        "role": UserRole.PATIENT,
        "first_name": "Maria",
        "last_name": "Wiśniewska",
        "birth_date": date(1985, 11, 3),
    },
]


def seed() -> None:
    with SessionLocal() as session:
        existing = session.scalar(select(User).where(User.email == "admin@gabinet.local"))
        if existing is not None:
            return

        password_hash = hash_password(DEMO_PASSWORD)
        created: dict[str, User] = {}
        for item in USERS:
            user = User(
                email=item["email"],
                password_hash=password_hash,
                role=item["role"],
                first_name=item["first_name"],
                last_name=item["last_name"],
                phone=item.get("phone"),
            )
            session.add(user)
            created[item["email"]] = user
        session.flush()

        doctor = DoctorProfile(
            user_id=created["lekarz@gabinet.local"].id,
            specialization="Dermatologia",
            bio="Lekarz przyjmujący w gabinecie demonstracyjnym.",
        )
        session.add(doctor)
        session.flush()

        for item in USERS:
            if item["role"] != UserRole.PATIENT:
                continue
            session.add(
                PatientProfile(
                    user_id=created[item["email"]].id,
                    birth_date=item["birth_date"],
                )
            )

        for weekday in range(5):
            session.add(
                WorkingHours(
                    doctor_id=doctor.id,
                    weekday=weekday,
                    start_time=time(9, 0),
                    end_time=time(17, 0),
                )
            )

        session.add_all(
            [
                Service(name="Konsultacja", duration_minutes=30, price=200),
                Service(name="Kontrola", duration_minutes=20, price=150),
                Service(name="Zabieg", duration_minutes=45, price=350),
            ]
        )
        session.commit()


if __name__ == "__main__":
    seed()
