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
| localhost:5432 | PostgreSQL (tylko lokalnie / dla narzędzi) |

`/health` zwraca `database: ok` dopiero gdy API połączy się z Postgresem.  
Przy starcie kontenera `api` Alembic sam wykonuje `upgrade head`.

Ręcznie (np. po nowej migracji):

```powershell
docker compose exec api alembic upgrade head
```

Zatrzymanie:

```powershell
docker compose down
```

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
