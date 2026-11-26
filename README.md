# Task Management

Personal workspace for managing tasks across separate boards such as Personal, Work, and Friends.

**Stack:** FastAPI · Next.js 12 (Pages Router, runs on Node 12.16+) · PostgreSQL · SQLAlchemy · TanStack Query · `@dnd-kit/react`

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

### Changing the server address

No code changes are needed; set these and restart:

| File | Setting | What it is |
|------|---------|------------|
| `backend/.env` | `PUBLIC_BASE_URL` | Address browsers use to reach the API (image and file links are built from it, including images already in tasks). |
| `backend/.env` | `CORS_ORIGINS` | Comma-separated addresses the frontend is served from. |
| `frontend/.env.local` | `NEXT_PUBLIC_API_URL` | Same address as `PUBLIC_BASE_URL`. Built into the app: run `npm run build` again after changing it. Unset, the app uses port 8000 on the host it was loaded from. |

The backend always reads `backend/.env`, whichever folder it is started from; real environment variables override it.

**Node 12.16 notes**

- Always use the npm scripts (`npm run dev`, `build`, `start`, `lint`, `test`). They pass `--experimental-modules`, which Next.js 12 needs on Node < 12.17. Running `npx next ...` directly fails on 12.16.
- Some dev dependencies are pinned to the newest versions that support Node 12.16. Don't upgrade them without checking their `engines.node`: `eslint` 7.32.0, `eslint-config-next` 12.0.4, `browserslist` 4.28.1, `core-js-compat` 3.49.0, `node-releases` 2.0.44, `sucrase` 3.34.0.
- `next` (declares >=12.22), `typescript` 5.0.4 (declares >=12.20) and `type-fest` (types only, from Mantine) declare newer Node versions but are tested to work on 12.16.

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
| `GET` | `/boards/{board_id}/members` | Board owner, members and (owner only) pending invitations |
| `POST` | `/boards/{board_id}/members` | Owner shares the board by email (unknown emails join on sign-up) |
| `DELETE` | `/boards/{board_id}/members/{user_id}` | Owner removes a member, or a member leaves |
| `DELETE` | `/boards/{board_id}/invitations/{id}` | Owner cancels a pending invitation |
| `GET` | `/plans` | List plans with progress counts |
| `POST` | `/plans` | Create a plan |
| `GET` / `PATCH` / `DELETE` | `/plans/{plan_id}` | Plan with its days and items / rename / delete |
| `POST` | `/plans/{plan_id}/days` | Add a day to a plan (one per date) |
| `PATCH` / `DELETE` | `/plan-days/{day_id}` | Change a day's date or label / delete it |
| `POST` | `/plan-days/{day_id}/items` | Add a checkbox item |
| `PATCH` / `DELETE` | `/plan-items/{item_id}` | Rename, check or uncheck / delete an item |
| `GET` | `/calendar/tasks?start_date=&end_date=` | Tasks due in a date range across accessible boards (see below) |
| `GET` | `/search?q=` | Search tasks, boards, notes and plans (see below) |
| `GET` | `/notifications` | Generate due notifications and return the feed |
| `GET` / `PATCH` | `/notifications/preferences` | Digest, schedule, reminder and quiet-hour settings |

Shared boards: members can create, edit, move, delete and assign tasks and create categories. Statuses, board settings and membership are owner-only (`403` for members).
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

### Calendar: `GET /calendar/tasks`

Top-level tasks whose `due_date` is within the range (both ends inclusive), on active boards you own or are a member of. Archived boards, archived statuses and sub-tasks are left out. The date filter runs in PostgreSQL.

| Query parameter | Required | Notes |
|-----------------|----------|-------|
| `start_date` | yes | `YYYY-MM-DD`, first day shown |
| `end_date` | yes | `YYYY-MM-DD`, last day shown. At most 62 days after `start_date` counted inclusively (`422 date_range_too_long`); before `start_date` is `422 end_before_start` |
| `board_id` | no | Only this board; `404` if you can't access it |
| `limit` | no | Default 500, 1–1000 |

```json
{
  "start_date": "2026-07-27",
  "end_date": "2026-09-06",
  "items": [
    {
      "id": "uuid", "title": "Write report", "start_date": "2026-08-18", "due_date": "2026-08-20",
      "is_done": false, "priority": "high",
      "board_id": "uuid", "board_name": "Work", "board_color": "blue",
      "status_id": "uuid", "status_name": "Todo"
    }
  ],
  "truncated": false,
  "limit": 500
}
```

`truncated` is `true` when the range holds more than `limit` tasks; the soonest are returned (by due date, then priority and title). The calendar reschedules through `PATCH /tasks/{id}`.

### Search: `GET /search`

Case-insensitive substring search (`ILIKE`, with `%` and `_` in the query matched literally), run in the database.

| Query parameter | Notes |
|-----------------|-------|
| `q` | Text to find. Empty or blank returns `{"query": "", "groups": []}`. Max 200 characters (the first 100 are used). |
| `type` | Optional: `task`, `board`, `note` or `plan` |
| `limit` | Results per type, default 5, 1–20 |

What is searched, and who can see it:

- **Tasks:** title, description text and the plain text of the rich-text content. Top-level tasks on active boards and statuses you own or share.
- **Boards:** name. Active boards you own or share.
- **Notes:** title and body. Your own notes only.
- **Plans:** name and description. Your own plans only.

```json
{
  "query": "report",
  "groups": [
    {
      "type": "task",
      "has_more": false,
      "items": [
        {
          "type": "task", "id": "uuid", "label": "Write report",
          "secondary": "…a short snippet around the match (at most 120 characters)…",
          "board_id": "uuid", "board_name": "Work", "board_color": "blue",
          "due_date": "2026-08-20", "is_done": false
        }
      ]
    }
  ]
}
```

Every result has the same shape. Only `type`, `id` and `label` are always set: `board_*`, `due_date` and `is_done` are for tasks (`board_*` also for boards), and `secondary` is a snippet or description. Full rich-text documents are never returned. Groups with no matches are omitted, and `has_more` says more matches exist than `limit`.

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
