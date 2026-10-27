from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import select

from app.core.passwords import hash_password
from app.db.session import SessionLocal
from app.models import (
    Appointment,
    AppointmentStatus,
    BodyFigure,
    BodySide,
    DoctorProfile,
    MedicalReport,
    PatientProfile,
    Service,
    SkinFinding,
    User,
    UserRole,
    WorkingHours,
)

DEMO_PASSWORD = "Demo123!"

USERS = [
    {
        "email": "admin@gabinet.pl",
        "role": UserRole.ADMIN,
        "first_name": "Administrator",
        "last_name": "Gabinetu",
    },
    {
        "email": "lekarz@gabinet.pl",
        "role": UserRole.DERMATOLOGIST,
        "first_name": "Anna",
        "last_name": "Kowalska",
        "phone": "500100200",
    },
    {
        "email": "jan.nowak@gabinet.pl",
        "role": UserRole.PATIENT,
        "first_name": "Jan",
        "last_name": "Nowak",
        "birth_date": date(1990, 4, 12),
    },
    {
        "email": "maria.wisniewska@gabinet.pl",
        "role": UserRole.PATIENT,
        "first_name": "Maria",
        "last_name": "Wiśniewska",
        "birth_date": date(1985, 11, 3),
    },
]


def seed() -> None:
    with SessionLocal() as session:
        existing = session.scalar(select(User).where(User.email == "admin@gabinet.pl"))
        if existing is not None:
            return

        password_hash = hash_password(DEMO_PASSWORD)
        consent_at = datetime.now(timezone.utc)
        created: dict[str, User] = {}
        for item in USERS:
            user = User(
                email=item["email"],
                password_hash=password_hash,
                role=item["role"],
                first_name=item["first_name"],
                last_name=item["last_name"],
                phone=item.get("phone"),
                consent_at=consent_at,
            )
            session.add(user)
            created[item["email"]] = user
        session.flush()

        doctor = DoctorProfile(
            user_id=created["lekarz@gabinet.pl"].id,
            specialization="Dermatologia",
            bio="Lekarz przyjmujący w gabinecie demonstracyjnym.",
        )
        session.add(doctor)
        session.flush()

        patients: dict[str, PatientProfile] = {}
        for item in USERS:
            if item["role"] != UserRole.PATIENT:
                continue
            profile = PatientProfile(
                user_id=created[item["email"]].id,
                birth_date=item["birth_date"],
            )
            session.add(profile)
            patients[item["email"]] = profile
        session.flush()

        for weekday in range(5):
            session.add(
                WorkingHours(
                    doctor_id=doctor.id,
                    weekday=weekday,
                    start_time=time(9, 0),
                    end_time=time(17, 0),
                )
            )

        konsultacja = Service(name="Konsultacja", duration_minutes=30, price=200)
        kontrola = Service(name="Kontrola", duration_minutes=20, price=150)
        zabieg = Service(name="Zabieg", duration_minutes=45, price=350)
        session.add_all([konsultacja, kontrola, zabieg])
        session.flush()

        _seed_demo_data(
            session,
            doctor,
            patients["jan.nowak@gabinet.pl"],
            patients["maria.wisniewska@gabinet.pl"],
            konsultacja,
            kontrola,
        )
        session.commit()


def _demo_day(now: datetime, days: int, hour: int = 10) -> datetime:
    """Dzień względem „dziś”, przesunięty na dzień roboczy (gabinet pn–pt)."""
    moment = (now + timedelta(days=days)).replace(
        hour=hour, minute=0, second=0, microsecond=0
    )
    while moment.weekday() >= 5:
        moment += timedelta(days=1)
    return moment


def _seed_demo_data(
    session,
    doctor: DoctorProfile,
    jan: PatientProfile,
    maria: PatientProfile,
    konsultacja: Service,
    kontrola: Service,
) -> None:
    """Pokazowy zestaw na obronę: przeszłe i przyszłe wizyty oraz dokumentacja
    dermatologiczna ze zmianami na mapie ciała (2 raporty Jana — do porównania)."""
    now = datetime.now(timezone.utc)

    session.add_all(
        [
            Appointment(
                patient_id=jan.id,
                doctor_id=doctor.id,
                service_id=konsultacja.id,
                start_at=_demo_day(now, -21),
                end_at=_demo_day(now, -21) + timedelta(minutes=konsultacja.duration_minutes),
                status=AppointmentStatus.COMPLETED,
            ),
            Appointment(
                patient_id=jan.id,
                doctor_id=doctor.id,
                service_id=kontrola.id,
                start_at=_demo_day(now, 7),
                end_at=_demo_day(now, 7) + timedelta(minutes=kontrola.duration_minutes),
                status=AppointmentStatus.CONFIRMED,
            ),
            Appointment(
                patient_id=maria.id,
                doctor_id=doctor.id,
                service_id=konsultacja.id,
                start_at=_demo_day(now, 9, 11),
                end_at=_demo_day(now, 9, 11) + timedelta(minutes=konsultacja.duration_minutes),
                status=AppointmentStatus.CONFIRMED,
            ),
        ]
    )

    raport_jan_1 = MedicalReport(
        patient_id=jan.id,
        doctor_id=doctor.id,
        body_figure=BodyFigure.MALE,
        notes=(
            "Zmiany trądzikowe w okolicy czoła i policzków. Zalecono żel z kwasem "
            "azelainowym 2× dziennie oraz kontrolę za 3 tygodnie."
        ),
        created_at=_demo_day(now, -21, 11),
    )
    raport_jan_2 = MedicalReport(
        patient_id=jan.id,
        doctor_id=doctor.id,
        body_figure=BodyFigure.MALE,
        notes=(
            "Wyraźna poprawa — zmiany zapalne wygaszone, pozostały przebarwienia "
            "pozapalne. Kontynuować pielęgnację, kolejna kontrola za miesiąc."
        ),
        created_at=_demo_day(now, -7, 11),
    )
    raport_maria = MedicalReport(
        patient_id=maria.id,
        doctor_id=doctor.id,
        body_figure=BodyFigure.FEMALE,
        notes=(
            "Znamiona barwnikowe na plecach bez cech niepokojących. Zalecona "
            "samokontrola i badanie kontrolne za 6 miesięcy."
        ),
        created_at=_demo_day(now, -14, 12),
    )
    session.add_all([raport_jan_1, raport_jan_2, raport_maria])
    session.flush()

    def marker(x: int, y: int) -> dict:
        return {"kind": "marker", "x": x, "y": y}

    session.add_all(
        [
            # Jan — pierwsza wizyta: aktywne zmiany trądzikowe (twarz)
            SkinFinding(
                patient_id=jan.id,
                report_id=raport_jan_1.id,
                side=BodySide.FRONT,
                geometry=marker(200, 96),
                color="czerwony",
                finding_type="krostka",
                description="Pojedyncza zmiana zapalna na czole, obecna od ok. tygodnia.",
                created_at=_demo_day(now, -21, 11),
            ),
            SkinFinding(
                patient_id=jan.id,
                report_id=raport_jan_1.id,
                side=BodySide.FRONT,
                geometry=marker(232, 126),
                color="czerwony",
                finding_type="krostka",
                description="Zmiana zapalna na policzku prawym.",
                created_at=_demo_day(now, -21, 11),
            ),
            SkinFinding(
                patient_id=jan.id,
                report_id=raport_jan_1.id,
                side=BodySide.FRONT,
                geometry=marker(168, 126),
                color="brązowy",
                finding_type="zaskórniak",
                description="Zaskórniak zamknięty bez cech zapalenia.",
                created_at=_demo_day(now, -21, 11),
            ),
            # Jan — kontrola: wygaszenie, przebarwienia pozapalne
            SkinFinding(
                patient_id=jan.id,
                report_id=raport_jan_2.id,
                side=BodySide.FRONT,
                geometry=marker(200, 96),
                color="różowy",
                finding_type="przebarwienie pozapalne",
                description="Ślad pozapalny po zmianie — bez nowych krost.",
                created_at=_demo_day(now, -7, 11),
            ),
            SkinFinding(
                patient_id=jan.id,
                report_id=raport_jan_2.id,
                side=BodySide.FRONT,
                geometry=marker(232, 126),
                color="różowy",
                finding_type="przebarwienie pozapalne",
                description="Wygaszenie zmiany zapalnej na policzku.",
                created_at=_demo_day(now, -7, 11),
            ),
            # Maria — znamiona na plecach
            SkinFinding(
                patient_id=maria.id,
                report_id=raport_maria.id,
                side=BodySide.BACK,
                geometry=marker(200, 330),
                color="brązowy",
                finding_type="znamię barwnikowe",
                description="Znamię ok. 4 mm, równomierne, bez cech niepokojących — do obserwacji.",
                created_at=_demo_day(now, -14, 12),
            ),
            SkinFinding(
                patient_id=maria.id,
                report_id=raport_maria.id,
                side=BodySide.BACK,
                geometry=marker(245, 280),
                color="brązowy",
                finding_type="znamię barwnikowe",
                description="Znamię 3 mm, stabilne od lat według pacjentki.",
                created_at=_demo_day(now, -14, 12),
            ),
        ]
    )
    session.flush()


if __name__ == "__main__":
    seed()
