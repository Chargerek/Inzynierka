# Inżynierka

Aplikacja webowa do rezerwacji wizyt i dokumentacji dermatologicznej.

## Wymagania

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows)

## Uruchomienie (główna ścieżka)

```powershell
cd C:\Users\damia\source\repos\Inzynierka
copy .env.example .env
docker compose up --build
```

Po starcie:

| Adres | Co to jest |
|-------|------------|
| http://localhost:3000 | Frontend (Next.js) |
| http://localhost:8000/health | REST API — healthcheck |
| http://localhost:8000/docs | Swagger (dokumentacja REST) |
| http://localhost:8025 | Mailpit — podgląd wysyłanych e-maili (dev) |
| localhost:5432 | PostgreSQL (tylko lokalnie / dla narzędzi) |

Powiadomienia e-mail (rezerwacja, odwołanie, przypomnienie 24 h) trafiają do
Mailpita — żadna wiadomość nie opuszcza komputera. Przypomnienia uruchamia się
ręcznie: `POST /appointments/run-reminders` (rola lekarz/admin, patrz Swagger).

`/health` zwraca `database: ok` dopiero gdy API połączy się z Postgresem.  
Przy starcie kontenera `api` Alembic wykonuje migracje, a potem skrypt seed wstawia konta demo (tylko gdy bazy jeszcze nie ma).

| Konto | E-mail | Hasło |
|-------|--------|-------|
| Administrator | admin@gabinet.pl | Demo123! |
| Dermatolog | lekarz@gabinet.pl | Demo123! |
| Pacjent | jan.nowak@gabinet.pl | Demo123! |
| Pacjentka | maria.wisniewska@gabinet.pl | Demo123! |

Ręcznie (np. po nowej migracji):

```powershell
docker compose exec api alembic upgrade head
```

Zatrzymanie:

```powershell
docker compose down
```

## Prywatność i bezpieczeństwo

Skrót zasad (role, zgoda przy rejestracji, limity i weryfikacja uploadów, bcrypt):
[docs/prywatnosc.md](docs/prywatnosc.md).

## Struktura

```
apps/web  — Next.js (TypeScript + Tailwind)
apps/api  — FastAPI (REST API, Python)
```

## Development bez pełnego Compose (opcjonalnie)

API lokalnie (wymaga Pythona + venv):

```powershell
cd apps\api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Frontend lokalnie (wymaga Node.js):

```powershell
cd apps\web
npm install
npm run dev
```

## Plan pracy

Szczegóły etapów: `Plan.md`.
