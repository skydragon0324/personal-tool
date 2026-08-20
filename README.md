# Life Management

Personal workspace for managing tasks across separate boards such as Personal, Work, and Friends.

**Stack:** FastAPI · Next.js (App Router) · PostgreSQL · SQLAlchemy · TanStack Query · `@dnd-kit/react`

## Quick start

### 1. Database

**Option A — Docker**

```bash
docker compose up -d
# DATABASE_URL=postgresql://todo:todo@localhost:5432/daily_todo
```

**Option B — Project-local Postgres** (already used if `.pgdata` exists on port 5433)

```bash
# Start (Windows example)
& "C:\Program Files\PostgreSQL\14\bin\pg_ctl.exe" -D ".pgdata" -l ".pgdata/logfile" start
# DATABASE_URL=postgresql://todo:todo@127.0.0.1:5433/daily_todo
```

### 2. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
copy .env.example .env          # then set DATABASE_URL, TEST_DATABASE_URL, CORS_ORIGINS
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs  
Health: http://localhost:8000/api/v1/health

Default seeded board id: `a0000000-0000-4000-8000-000000000001` (named **Personal** after migrations). Open the app at `/` to restore the last board, or go to `/boards/{id}`.

### 3. Frontend

```bash
cd frontend
copy .env.example .env.local
npm install
npm run dev
```

App: http://localhost:3000

## API (`/api/v1`)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/boards` | List boards |
| `POST` | `/boards` | Create a board with default statuses and Uncategorized |
| `GET` | `/boards/{board_id}` | Board metadata and task counts |
| `PATCH` | `/boards/{board_id}` | Update board name, color, icon, timezone |
| `PATCH` | `/boards/{board_id}/reorder` | Reorder active boards |
| `POST` | `/boards/{board_id}/archive` | Archive a board (keeps its data) |
| `POST` | `/boards/{board_id}/restore` | Restore an archived board |
| `GET` | `/boards/{board_id}/view?date=` | Board columns + tasks for a day |
| `POST` | `/tasks` | Create task |
| `PATCH` | `/tasks/{id}` | Update task fields |
| `PATCH` | `/tasks/{id}/move` | Transactional reorder / column move |
| `DELETE` | `/tasks/{id}` | Delete task |
| `POST` | `/columns/{id}/restore` | Restore an archived status |
| `GET` | `/health` | Health check |

Move body:

```json
{
  "target_column_id": "uuid",
  "target_position": 2,
  "expected_version": 4
}
```

Returns `409` when `expected_version` is stale.

## Tests

Backend tests **must** use a dedicated database. They never fall back to `DATABASE_URL`.

1. Create a separate database (do not reuse the development database):

```sql
CREATE DATABASE daily_todo_test;
```

2. Set `TEST_DATABASE_URL` in `backend/.env`. It must point at a different database than `DATABASE_URL`:

```
DATABASE_URL=postgresql://todo:todo@127.0.0.1:5433/daily_todo
TEST_DATABASE_URL=postgresql://todo:todo@127.0.0.1:5433/daily_todo_test
```

3. Run tests:

```bash
cd backend
pytest app/tests -v
```

If `TEST_DATABASE_URL` is missing or identical to `DATABASE_URL`, pytest stops immediately with an error. Test commits are rolled back so they cannot leak into other tests or the development database. Existing development data is never deleted automatically.

Frontend:

```bash
cd frontend
npm test
npm run lint
npx tsc --noEmit
npm run build
```
