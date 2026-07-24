# Daily To-Do

A simple full-stack personal productivity app for managing daily tasks.

**Stack:** FastAPI · Next.js (App Router) · PostgreSQL · SQLModel · Tailwind CSS

## Folder structure

```
daily-todo/
├── docker-compose.yml          # PostgreSQL
├── README.md
├── backend/
│   ├── .env.example
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/                # Database migrations
│   └── app/
│       ├── main.py             # FastAPI entrypoint
│       ├── config.py           # Settings from env
│       ├── database.py         # Engine + session
│       ├── models.py           # SQLModel tables
│       ├── schemas.py          # Pydantic request/response models
│       ├── crud.py             # Database operations
│       └── routers/tasks.py    # REST API routes
└── frontend/
    ├── .env.example
    ├── src/
    │   ├── app/                # Next.js App Router pages
    │   ├── components/         # UI components
    │   └── lib/                # API client + types
    └── package.json
```

## Prerequisites

- Python 3.11+
- Node.js 18+
- Docker (for PostgreSQL)

## Quick start

### 1. Start PostgreSQL

```bash
docker compose up -d
```

### 2. Backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
copy .env.example .env   # Windows
# cp .env.example .env   # macOS / Linux

# Optional: run migrations (tables are also created on API startup)
alembic upgrade head

uvicorn app.main:app --reload --port 8000
```

API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

### 3. Frontend

In a second terminal:

```bash
cd frontend
copy .env.example .env.local   # Windows
# cp .env.example .env.local   # macOS / Linux

npm install
npm run dev
```

App: [http://localhost:3000](http://localhost:3000)

## API overview

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/tasks` | List tasks (`due_date`, `completed`, `priority` query filters) |
| `GET` | `/tasks/summary` | Dashboard counts for a day (defaults to today) |
| `GET` | `/tasks/{id}` | Get one task |
| `POST` | `/tasks` | Create a task |
| `PATCH` | `/tasks/{id}` | Update a task |
| `DELETE` | `/tasks/{id}` | Delete a task |
| `GET` | `/health` | Health check |

### Task fields

- `title` (required)
- `description` (optional)
- `due_date` (YYYY-MM-DD)
- `priority` (`low` \| `medium` \| `high`)
- `completed` (boolean)
- `created_at` (set automatically)

## Environment variables

**Backend (`backend/.env`)**

| Variable | Example | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `postgresql://todo:todo@localhost:5432/daily_todo` | PostgreSQL connection |
| `CORS_ORIGINS` | `http://localhost:3000` | Allowed frontend origins (comma-separated) |

**Frontend (`frontend/.env.local`)**

| Variable | Example | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | FastAPI base URL |

## Features

- Create, edit, delete, and complete daily tasks
- Default view shows today’s tasks
- Filter by date, status, and priority
- Dashboard summary: total / completed / remaining for today
- Loading and empty states in the UI
