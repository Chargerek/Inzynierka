# Plan realizacji — Inzynierka

**Temat:** Aplikacja webowa do rezerwacji wizyt i dokumentacji dermatologicznej  
**Autor:** Damian Zdrodowski  
**Promotor:** dr inż. Marek Tabędzki  

Wymagania źródłowe: `założenia_dotychczas.md`.

**Zasada commitów:** jeden etap = jeden działający feature ≈ **jeden commit** (po przejściu testu ręcznego). Punkty na liście w etapie to checklista robocza, nie osobne commity.

---

## 0. Kontekst i MVP ✅

### Cel
1. Rezerwacja wizyt online (UX w stylu Booksy)  
2. Graficzna dokumentacja zmian skórnych na mapie ciała 2D (przód/tył)

### Aktorzy
| Rola | Główne działania |
|------|------------------|
| Pacjent | Rezerwacja, historia, odwołanie, cennik |
| Dermatolog | Kalendarz, dostępność, mapa ciała, kartoteka |
| Administrator | Użytkownicy, cennik, godziny pracy, typy wizyt |
| System | Powiadomienia e-mail |

### MVP (zatwierdzone)
- Rejestracja / logowanie (role)
- Rezerwacja wizyt online
- Kalendarz dermatologa
- Podstawowa kartoteka pacjenta
- Interaktywna mapa ciała ze zaznaczaniem (2D przód/tył)

### Po MVP (nie w pierwszej kolejności)
Porównanie zmian w czasie, formularze onboardingowe, maile przypominające (e-mail po rezerwacji można wcześniej), SMS/push, płatności, chat, app natywna.

### Decyzje (2026-10-16, Docker 2026-10-18)
| # | Wybór |
|---|--------|
| D1 | Jeden folder repo `Inzynierka` |
| D2 | API osobno: **REST** FastAPI w `apps/api` |
| D3 | JWT w FastAPI |
| D4 | Zdjęcia na dysku / volume Dockera `uploads/` |
| D5 | Mapa 2D przód/tył |
| D6 | Demo lokalnie na laptopie przez **Docker Compose** |
| D7 | UI tylko PL |
| D8 | Compose: **osobne kontenery** `web` + `api` + `db` (+ `mailpit` później) |

---

## 1. Stack

| Warstwa | Technologia |
|---------|-------------|
| Frontend | React + TypeScript + Next.js + Tailwind |
| Formularze | React Hook Form + Zod |
| Mapa ciała | Konva / react-konva |
| Backend | Python 3.11+ / **FastAPI REST API** + Uvicorn |
| Schematy API | Pydantic v2 (JSON, OpenAPI/Swagger) |
| ORM | SQLAlchemy 2.0 + Alembic |
| DB | PostgreSQL |
| Auth | JWT (PyJWT) + passlib/bcrypt |
| Mail | aiosmtplib / fastapi-mail + Mailpit (kontener) |
| Pliki | volume `uploads/` |
| Infra | **Docker + Docker Compose** (docelowy sposób uruchamiania) |
| Testy | pytest + httpx; Playwright; Postman/Swagger |

### Uruchamianie (docelowe)

```text
docker compose up --build
→ http://localhost:3000        strona (kontener web)
→ http://localhost:8000/docs   REST API / Swagger (kontener api)
→ postgres                     tylko w sieci Dockera (kontener db)
```

```
[przeglądarka]
      │
      ▼
[web :3000]  --REST/JSON-->  [api :8000]  -->  [db :5432]
                                  │
                                  +--> volume uploads/
                                  +--> [mailpit] (etap maili)
```

Jeden kontener na warstwę — nie pakujemy frontu i API w jeden image.

---

## 2. Struktura folderów (propozycja)

Nazwa repo: **Inzynierka**.

```
Inzynierka/
├── README.md                 # głównie: docker compose up
├── Plan.md
├── założenia_dotychczas.md
├── docker-compose.yml        # serwisy: web, api, db [, mailpit]
├── .env.example
├── .gitignore
├── docs/
│   ├── er.md
│   ├── demo-script.md
│   └── demo-checklist.md
├── postman/
└── apps/
    ├── api/
    │   ├── Dockerfile
    │   ├── app/
    │   │   ├── main.py
    │   │   ├── core/
    │   │   ├── models/
    │   │   ├── schemas/
    │   │   ├── routers/      # REST: /auth, /appointments, ...
    │   │   ├── services/
    │   │   └── db/
    │   ├── alembic/
    │   ├── tests/
    │   ├── uploads/          # gitignore; w compose = volume
    │   ├── requirements.txt
    │   └── alembic.ini
    └── web/
        ├── Dockerfile
        ├── src/
        │   ├── app/
        │   ├── components/
        │   ├── features/
        │   └── lib/
        ├── public/
        │   └── body/
        └── package.json
```

---

## 3. Zasady pracy

1. Robimy **jeden etap naraz**.  
2. Etap gotowy = feature działa ręcznie → **jeden commit** z opisem po polsku (np. `feat: rezerwacje wizyt w API`).  
3. Przy pracy nad etapem: `Plan.md` (bieżący etap), fragment założeń i aktualny kod.  
4. Po etapie: README aktualne, jeśli zmienił się start.  
5. **Domyślny start projektu = Docker Compose** (`web` + `api` + `db`).  
6. Kolejność: szkielet + Docker → schemat → REST auth → REST rezerwacje → UI → mapa → reszta.

**„Działa” =** `docker compose up` podnosi stack, happy path OK, dane w volume DB przeżywają restart.

---

## 4. Etapy (feature ≈ commit)

### Etap 0 — Kickoff ✅
MVP, decyzje D1–D7, struktura folderów — domknięte.

---

### Etap 1 — Scaffold + Docker Compose (web / api / db)
**Feature:** szkielet Next + FastAPI REST oraz cały stack w Dockerze pod jednym `compose up`.

Checklista:
- [x] Drzewo katalogów jak w §2 (`Dockerfile` w `apps/web` i `apps/api`)
- [x] Next.js + TS + Tailwind + ESLint/Prettier
- [x] FastAPI REST: `GET /health`, CORS, Swagger `/docs`
- [x] `docker-compose.yml`: serwisy **`web`**, **`api`**, **`db`** (osobne kontenery)
- [x] Volume na dane Postgres; sieć wewnętrzna (`api` łączy się z hostem `db`)
- [x] `.env.example`, `.gitignore`
- [x] README: główna ścieżka = `docker compose up --build` + adresy URL

**Test:** `docker compose up --build` → `http://localhost:3000` działa, `http://localhost:8000/health` = 200, `/docs` otwiera Swagger.  
*(Na maszynie deweloperskiej bez Dockera: API i build web zweryfikowane lokalnie — Compose do sprawdzenia po instalacji Docker Desktop.)*  
**Commit:** `chore: szkielet aplikacji i Docker Compose`

---

### Etap 2 — DB w kontenerze + Alembic
**Feature:** API w Dockerze realnie łączy się z Postgresem; migracje działają.

Checklista:
- [x] `DATABASE_URL` wskazuje na serwis `db` w Compose
- [x] Alembic zainicjalizowany; migracja odpalana przy starcie api albo jedną komendą w README
- [x] Restart `docker compose down` / `up` — baza i połączenie OK

**Test:** po restarcie kontenerów API nadal łączy się z DB (`/health` → `database: ok`, `alembic_version` = `0001_init`).  
**Commit:** `chore: połączenie API z Postgresem i Alembic`

---

### Etap 3 — Model danych + seed
**Feature:** schemat MVP w DB + konta demo.

Encje: `User`, `PatientProfile`, `DoctorProfile`, `WorkingHours`, `Service`, `Appointment`, `SkinFinding`, `FindingPhoto`.

Checklista:
- [x] `docs/er.md` (mermaid)
- [x] Modele SQLAlchemy + migracja Alembic
- [x] Seed: admin, 1 lekarz, 2 pacjentów, usługi, godziny
- [x] Indeksy: unique email; `(doctor_id, start)` na wizytach

**Test:** seed → konta w DB, hasła demo w README, hash bcrypt, po restarcie API nadal 4 użytkowników.  
**Commit:** `feat: schemat bazy i dane demo`

---

### Etap 4 — Auth REST API ✅
**Feature:** rejestracja pacjenta, login JWT, role, `/me` (endpointy REST).

Checklista:
- [x] `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- [x] bcrypt + walidacja Pydantic
- [x] Dependency ról → 403 dla złej roli
- [x] Lekarz tworzony tylko przez admina
- [x] Smoke w Swagger; opcjonalnie 2–3 testy pytest

**Test:** rejestracja → login → `/me`; zły token 401; pacjent na admin 403.  
**Commit:** `feat: logowanie JWT i role w API`

---

### Etap 5 — Rezerwacje REST API ✅
**Feature:** usługi, sloty, rezerwacja, odwołanie, kalendarz lekarza (REST/JSON).

Checklista:
- [x] CRUD usług (admin)
- [x] Godziny pracy / dostępność
- [x] `GET /availability` bez overlappingów
- [x] Rezerwacja + konflikt 409
- [x] Odwołanie (np. reguła >24h)
- [x] Lista wizyt lekarza `from`/`to`
- [x] Publiczny cennik `GET /services`

**Test:** slot → rezerwacja → drugi raz błąd → odwołanie → slot wolny; lekarz widzi wizytę.  
**Commit:** `feat: rezerwacje wizyt w API`

---

### Etap 6 — Frontend: layout + auth (PL) ✅
**Feature:** landing, logowanie/rejestracja, panele wg roli.

Checklista:
- [x] Layout: publiczny / pacjent / lekarz / admin
- [x] Landing + CTA po polsku
- [x] Login/register → trzymanie tokena (ustać: memory vs cookie)
- [x] Guard tras (`/doctor/*` nie dla pacjenta)
- [x] Klient API; 401 → wylogowanie

**Test:** trzy role → trzy różne nawigacje; wylogowanie czyści sesję.  
**Commit:** `feat: logowanie i layouty ról`

---

### Etap 7 — Frontend: rezerwacje + kalendarz ✅
**Feature:** pełny happy path rezerwacji w UI.

Checklista:
- [x] Flow: usługa → lekarz → data → slot → potwierdzenie
- [x] Historia + odwołanie u pacjenta
- [x] Cennik
- [x] Kalendarz lekarza + edycja dostępności
- [x] Admin: usługi (i lista userów minimum)

**Test:** pacjent rezerwuje → lekarz widzi → pacjent odwołuje → slot wolny.  
**Commit:** `feat: rezerwacje i kalendarz w UI`

---

### Etap 8 — Mapa ciała 2D
**Feature:** dermatolog zaznacza zmiany, zapis + opcjonalnie zdjęcie.

Checklista:
- [x] Assety przód/tył w `apps/web/public/body/`
- [x] Canvas Konva: zaznaczanie, kolor, typ, opis
- [x] Malowanie obszaru zmiany pędzlem (np. wysypka na całej części kończyny)
- [x] Zaznaczanie części ciała jednym kliknięciem (tryb Część ciała: głowa, klatka, kończyny L/P…)
- [x] Strefy części ciała jako wielokąty dopasowane do sylwetek (generator: `apps/web/scripts/generate-body-part-zones.py`)
- [x] Sylwetki: jednolity kolor dłoni i stóp, gładkie kontury (bez „fal" po trace), naprawiony kciuk kobiecej sylwetki
- [x] API CRUD `SkinFinding` (geometry JSON)
- [x] Upload zdjęcia do finding
- [x] Zdjęcia do całego raportu (upload, miniatury, usuwanie, kaskada przy usunięciu raportu)
- [x] Zoom/pan (mysz + touch)
- [x] Lista findings + podświetlenie na mapie
- [x] Sylwetka kobieta / mężczyzna (wybór zapisywany w raporcie)
- [x] Raporty (`MedicalReport`): kartoteka = lista raportów + wybór pacjenta; raport = notatka lekarska + zmiany na mapie

**Test:** zaznacz → odśwież → jest; zdjęcie widać.  
**Commit:** `feat: interaktywna mapa ciała 2D`

---

### Etap 9 — Historia dokumentacji / porównanie ✅
**Feature:** timeline + porównanie dwóch dat (poza ścisłym MVP, ale blisko mapy).

Checklista:
- [x] Oś czasu dokumentacji w kartotece (lista raportów z rail-em i znacznikami)
- [x] Wybór dwóch raportów checkboxem „do porównania” (tylko w obrębie pacjenta) + przycisk „Porównaj wybrane”
- [x] Widok side-by-side: dwie mapy tylko do odczytu ze wspólnym przełącznikiem przód/tył, kliknięcie zmiany podświetla ją na mapie
- [x] Panele: data/lekarz/sylwetka, lista zmian, notatka lekarska, zdjęcia z podglądem (lightbox)
- [x] Pasek podsumowania różnicy: liczba zmian i zdjęć przed → po (z deltą)

**Test:** dwa wpisy w czasie → side-by-side czytelne.  
**Commit:** `feat: historia zmian i porównanie`

---

### Etap 10 — Powiadomienia e-mail ✅
**Feature:** mail po rezerwacji/odwołaniu (+ przypomnienie 24h opcjonalnie).

Checklista:
- [x] Serwis **`mailpit`** w `docker-compose.yml` (SMTP `:1025`, UI `:8025`)
- [x] Trigger na create/cancel Appointment (wysyłka w tle, błąd SMTP nie przerywa żądania)
- [x] Endpoint ręcznego „run reminders” na dev (`POST /appointments/run-reminders`, bez duplikatów dzięki `reminder_sent_at`)
- [x] Szablony PL: potwierdzenie, odwołanie, przypomnienie (polskie nazwy dni/miesięcy, strefa Europe/Warsaw)

**Test:** rezerwacja → mail w UI Mailpita (port z compose, np. `:8025`).  
**Commit:** `feat: powiadomienia e-mail o wizytach`

---

### Etap 11 — Bezpieczeństwo (minimum pod dane medyczne) ✅
**Feature:** twardsze reguły dostępu i uploadu — to jest „checklist RODO” w praktyce (patrz §5 poniżej).

Checklista:
- [x] Pacjent widzi tylko swoje dane (test IDOR → 403; spójna `_require_patient_access` dla wszystkich ról)
- [x] Lekarz: dostęp do swoich pacjentów/wizyt (reguła „co najmniej jedna wizyta”, komunikat 403 po polsku)
- [x] Upload: limit 5 MB + tylko jpg/png/webp — dodatkowo weryfikacja zawartości po bajtach (magic bytes), `.exe` jako `image/jpeg` → 415
- [x] Checkbox zgody przy rejestracji + `consent_at` w DB (migracja 0006, walidacja 422, checkbox wymagany w UI)
- [x] Notatka [docs/prywatnosc.md](docs/prywatnosc.md): co trzymamy, bcrypt, brak PESEL, zdjęcia tylko z tokenem + link z README

**Test:** cudze ID → 403; `.exe` odrzucone (415); 6 MB → 413; rejestracja bez zgody → 422.  
**Commit:** `feat: kontrola dostępu i podstawy prywatności`

---

### Etap 12 — Testy automatyczne (smoke) ✅
**Feature:** kilka testów pod rozdział o testach w pracy.

Checklista:
- [x] pytest: sloty (overlapping) — `test_booking.py` (kolizja, sąsiednie sloty, statusy)
- [x] pytest: dymne HTTP przez TestClient na izolowanej bazie `inzynierka_test` (`test_api_smoke.py`): health, auth 401, rejestracja (zgoda 422 / duplikat 409 / login), cykl rezerwacji (201 → 409 konflikt → odwołanie → re-booking), termin poza godzinami, IDOR 403, lekarz bez wizyty 403, upload (.exe 415, 6 MB 413, JPEG 201)
- [x] Playwright: rezerwacja przez kreator + mapa ciała w kartotece (smoke, sprzątanie wizyty przez API po teście)
- [x] Export OpenAPI w `docs/openapi.json` (import do Postmana)

**Test:** `pytest` (49 zielonych) i `npx playwright test` (2 zielone) lokalnie.  
**Commit:** `test: testy dymne API i ścieżek E2E`

---

### Etap 13 — Polish + dane demo na obronę
**Feature:** UI dopracowany, seed pokazowy, skrypt klikania.

**Test:** desktop + tablet (mapa); `docs/demo-script.md` na 5 min.  
**Commit:** `chore: dopracowanie demo i dane na obronę`

---

### Etap 14 — Pakiet demo (Docker na drugim laptopie)
**Feature:** u kolegi wystarczy Docker Desktop + `docker compose up --build`.

Checklista:
- [ ] README: wymagania (Docker Desktop), jedna komenda startu, URL-e
- [ ] Seed / migracje w procesie startu albo 1 komenda po `up`
- [ ] `docs/demo-checklist.md` (porty 3000/8000 wolne itp.)

**Test:** świeży clone + Compose → `localhost:3000` działa bez instalacji Node/Python na hoście.  
**Commit:** `docs: instrukcja demo w Dockerze`

---

### Etap 15 — Tekst pracy dyplomowej
**Feature:** rozdziały spięte z realnym kodem (można pisać przyrostowo wcześniej; domknięcie = osobny „feature” dokumentacyjny).

Nie musi być jeden commit w repo kodu — często osobne pliki / Overleaf. Jeśli tekst też w repo: jeden commit na domknięcie wersji oddawanej.

---

## 5. O co chodziło z „checklistą RODO”?

To **nie** był osobny audyt prawny ani dokument do promotora na dzień dobry.

Chodziło o świadome minimum inżynierskie, bo w systemie są **dane zdrowotne** (wizyty, opisy zmian, zdjęcia skóry). Na pracę inżynierską wystarczy pokazać, że:

1. Hasła są hashowane (nie plain text)  
2. Są role i ograniczenie dostępu (pacjent ≠ cudze karty)  
3. Przy rejestracji jest zgoda na przetwarzanie (checkbox + kiedy kliknięto)  
4. Zdjęcia mają ograniczenia (typ/rozmiar), nie leżą publicznie bez auth  
5. Nie zbieramy zbędnych danych (np. PESEL tylko jeśli naprawdę trzeba)  
6. Wiesz, że to projekt demonstracyjny / lokalny — nie produkcja kliniczna

To wszystko robi **Etap 11** — nie zakładamy osobnego pliku „RODO.md” na starcie.

---

## 6. Ustalenia implementacyjne

- Stack: Next.js + TypeScript + Tailwind, FastAPI (REST), SQLAlchemy, Alembic, PostgreSQL, react-konva, JWT.
- Docker Compose: osobne kontenery `web`, `api` i `db` (później `mailpit`).
- Start: `docker compose up --build` → `localhost:3000` i `localhost:8000/docs`.
- UI tylko po polsku. Mapa ciała 2D, przód i tył.
- Jeden etap to jeden działający fragment i jeden commit.
- Poza zakresem na teraz: płatności, SMS, automatyczna analiza zdjęć. Backend zostaje w Pythonie (FastAPI), nie w NestJS.

---

## 7. Status

- [x] Etap 0 — Kickoff  
- [x] Etap 1 — Scaffold + Docker Compose (web/api/db)  
- [x] Etap 2 — Postgres + Alembic w Compose  
- [x] Etap 3 — Schema + seed  
- [x] Etap 4 — Auth REST API  
- [x] Etap 5 — Rezerwacje REST API  
- [x] Etap 6 — Auth UI  
- [x] Etap 7 — Rezerwacje UI  
- [x] Etap 8 — Mapa ciała  
- [x] Etap 9 — Historia / porównanie  
- [x] Etap 10 — E-mail (+ mailpit)  
- [x] Etap 11 — Bezpieczeństwo  
- [x] Etap 12 — Testy smoke  
- [ ] Etap 13 — Polish demo  
- [ ] Etap 14 — Runbook Docker  
- [ ] Etap 15 — Tekst pracy  

---

## 8. Następny krok

**Etap 13** — polish + dane demo na obronę.  
Napisz „rób etap 13”, gdy mam iść dalej.
