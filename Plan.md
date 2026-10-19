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

### Etap 4 — Auth REST API
**Feature:** rejestracja pacjenta, login JWT, role, `/me` (endpointy REST).

Checklista:
- [ ] `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- [ ] bcrypt + walidacja Pydantic
- [ ] Dependency ról → 403 dla złej roli
- [ ] Lekarz tworzony tylko przez admina
- [ ] Smoke w Swagger; opcjonalnie 2–3 testy pytest

**Test:** rejestracja → login → `/me`; zły token 401; pacjent na admin 403.  
**Commit:** `feat: logowanie JWT i role w API`

---

### Etap 5 — Rezerwacje REST API
**Feature:** usługi, sloty, rezerwacja, odwołanie, kalendarz lekarza (REST/JSON).

Checklista:
- [ ] CRUD usług (admin)
- [ ] Godziny pracy / dostępność
- [ ] `GET /availability` bez overlappingów
- [ ] Rezerwacja + konflikt 409
- [ ] Odwołanie (np. reguła >24h)
- [ ] Lista wizyt lekarza `from`/`to`
- [ ] Publiczny cennik `GET /services`

**Test:** slot → rezerwacja → drugi raz błąd → odwołanie → slot wolny; lekarz widzi wizytę.  
**Commit:** `feat: rezerwacje wizyt w API`

---

### Etap 6 — Frontend: layout + auth (PL)
**Feature:** landing, logowanie/rejestracja, panele wg roli.

Checklista:
- [ ] Layout: publiczny / pacjent / lekarz / admin
- [ ] Landing + CTA po polsku
- [ ] Login/register → trzymanie tokena (ustać: memory vs cookie)
- [ ] Guard tras (`/doctor/*` nie dla pacjenta)
- [ ] Klient API; 401 → wylogowanie

**Test:** trzy role → trzy różne nawigacje; wylogowanie czyści sesję.  
**Commit:** `feat: logowanie i layouty ról`

---

### Etap 7 — Frontend: rezerwacje + kalendarz
**Feature:** pełny happy path rezerwacji w UI.

Checklista:
- [ ] Flow: usługa → lekarz → data → slot → potwierdzenie
- [ ] Historia + odwołanie u pacjenta
- [ ] Cennik
- [ ] Kalendarz lekarza + edycja dostępności
- [ ] Admin: usługi (i lista userów minimum)

**Test:** pacjent rezerwuje → lekarz widzi → pacjent odwołuje → slot wolny.  
**Commit:** `feat: rezerwacje i kalendarz w UI`

---

### Etap 8 — Mapa ciała 2D
**Feature:** dermatolog zaznacza zmiany, zapis + opcjonalnie zdjęcie.

Checklista:
- [ ] Assety przód/tył w `apps/web/public/body/`
- [ ] Canvas Konva: zaznaczanie, kolor, typ, opis
- [ ] API CRUD `SkinFinding` (geometry JSON)
- [ ] Upload zdjęcia do finding
- [ ] Zoom/pan (mysz + touch)
- [ ] Lista findings + podświetlenie na mapie

**Test:** zaznacz → odśwież → jest; zdjęcie widać.  
**Commit:** `feat: interaktywna mapa ciała 2D`

---

### Etap 9 — Historia dokumentacji / porównanie
**Feature:** timeline + porównanie dwóch dat (poza ścisłym MVP, ale blisko mapy).

**Test:** dwa wpisy w czasie → side-by-side czytelne.  
**Commit:** `feat: historia zmian i porównanie`

---

### Etap 10 — Powiadomienia e-mail
**Feature:** mail po rezerwacji/odwołaniu (+ przypomnienie 24h opcjonalnie).

Checklista:
- [ ] Serwis **`mailpit`** w `docker-compose.yml`
- [ ] Trigger na create/cancel Appointment
- [ ] Endpoint ręcznego „run reminders” na dev

**Test:** rezerwacja → mail w UI Mailpita (port z compose, np. `:8025`).  
**Commit:** `feat: powiadomienia e-mail o wizytach`

---

### Etap 11 — Bezpieczeństwo (minimum pod dane medyczne)
**Feature:** twardsze reguły dostępu i uploadu — to jest „checklist RODO” w praktyce (patrz §5 poniżej).

Checklista:
- [ ] Pacjent widzi tylko swoje dane (test IDOR → 403)
- [ ] Lekarz: dostęp do swoich pacjentów/wizyt (jasna reguła)
- [ ] Upload: limit rozmiaru + tylko jpg/png/webp
- [ ] Checkbox zgody przy rejestracji + timestamp w DB
- [ ] Krótka notatka w README/docs: co trzymamy, hasła hashowane, brak PESEL jeśli niepotrzebny

**Test:** cudze ID → 403; `.exe` odrzucone.  
**Commit:** `feat: kontrola dostępu i podstawy prywatności`

---

### Etap 12 — Testy automatyczne (smoke)
**Feature:** kilka testów pod rozdział o testach w pracy.

Checklista:
- [ ] pytest: sloty (overlapping)
- [ ] Playwright: rezerwacja + mapa (smoke)
- [ ] Postman lub export OpenAPI w `docs/` / `postman/`

**Test:** `pytest` i `npx playwright test` zielone lokalnie.  
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
- [ ] Etap 4 — Auth REST API  
- [ ] Etap 5 — Rezerwacje REST API  
- [ ] Etap 6 — Auth UI  
- [ ] Etap 7 — Rezerwacje UI  
- [ ] Etap 8 — Mapa ciała  
- [ ] Etap 9 — Historia / porównanie  
- [ ] Etap 10 — E-mail (+ mailpit)  
- [ ] Etap 11 — Bezpieczeństwo  
- [ ] Etap 12 — Testy smoke  
- [ ] Etap 13 — Polish demo  
- [ ] Etap 14 — Runbook Docker  
- [ ] Etap 15 — Tekst pracy  

---

## 8. Następny krok

**Etap 4** — logowanie JWT i role w API.  
Napisz „rób etap 4”, gdy mam iść dalej.
