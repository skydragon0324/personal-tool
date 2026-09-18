# Life Management

Personal workspace for managing tasks across separate boards such as Personal, Work, and Friends.

**Stack:** FastAPI · Next.js 15 (App Router) · PostgreSQL · SQLAlchemy 2 · Alembic · TanStack Query · Mantine · `@dnd-kit/react`

This repository is set up to install **completely offline**. Every Python and JavaScript dependency is vendored in-tree, so no internet connection is needed on the machine you install it on.

---

## Contents

- [Prerequisites](#prerequisites)
- [Offline install (quick)](#offline-install-quick)
- [Offline install (manual)](#offline-install-manual)
- [Running the app](#running-the-app)
- [Configuration](#configuration)
- [How offline vendoring works](#how-offline-vendoring-works)
- [Moving the project to another machine](#moving-the-project-to-another-machine)
- [Troubleshooting](#troubleshooting)
- [API reference](#api-reference)
- [Tests](#tests)
- [Known issues](#known-issues)

---

## Prerequisites

These must already be installed on the target machine. They are **not** vendored — only the project's own dependencies are.

| Requirement | Version | Notes |
|---|---|---|
| Windows | 64-bit | The vendored wheels are `win_amd64` builds. |
| Python | **3.11**, 64-bit | Must be 3.11. The wheels in `backend/packages/` are `cp311` builds and will not install on 3.12+. |
| Node.js | **20.x** | Node 22 will probably work but is untested here. |
| PostgreSQL | 14 or newer | Tested against 18. Must be listening on `127.0.0.1:5432`. |

Verify all three before starting:

```powershell
python --version    # must print 3.11.x
node --version      # must print v20.x
Get-Service *postgres*   # must show Running
```

> **Why Python 3.11 specifically?** `backend/packages/` contains pre-compiled binary wheels — `psycopg2_binary`, `pydantic_core`, `SQLAlchemy`, `greenlet` and others ship compiled C extensions tied to one CPython version. A 3.12 interpreter will reject every `cp311` wheel and, with no internet to fall back on, the install fails outright.

---

## Offline install (quick)

From the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
```

The script is idempotent — re-running it is safe. It will:

1. Verify Python 3.11, Node 20, and locate `psql.exe`.
2. Create `backend\.env` and `frontend\.env.local` from their `.env.example` files (existing files are left untouched).
3. Create `backend\.venv` and install the backend from `backend\packages\`.
4. Install the frontend from `frontend\vendor\npm-cache\`.
5. Prompt for your **postgres superuser password**, then create the `todo` role and the `daily_todo` / `daily_todo_test` databases.
6. Run `alembic upgrade head`.

If you'd rather provision the database yourself, pass `-SkipDatabase` and follow step 4 of the manual instructions below.

---

## Offline install (manual)

Do this if the script fails, or if you want to understand each step.

### 1. Environment files

```powershell
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env.local
```

The defaults work for a standard local PostgreSQL install. See [Configuration](#configuration) if yours differs.

### 2. Backend dependencies

```powershell
cd backend
python -m venv .venv
.venv\Scripts\python.exe -m pip install --no-index --find-links=packages -r requirements.txt
```

`--no-index` forbids any network access, and `--find-links=packages` points pip at the vendored wheels. If this succeeds you have a complete backend install.

### 3. Frontend dependencies

```powershell
cd frontend
npm ci --offline --cache .\vendor\npm-cache
```

`--offline` makes npm fail loudly rather than silently reaching for the network, so a successful run proves the vendored cache is complete.

> Use `npm ci`, not `npm install`. `ci` installs exactly what `package-lock.json` pins; `install` may try to resolve newer versions and will fail without a network.

### 4. Database

The app connects as a role named `todo`. Create it with a superuser account:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h 127.0.0.1 -p 5432 -U postgres -d postgres
```

Then, at the `postgres=#` prompt:

```sql
CREATE ROLE todo WITH LOGIN PASSWORD 'todo' CREATEDB;
CREATE DATABASE daily_todo      OWNER todo;
CREATE DATABASE daily_todo_test OWNER todo;
\q
```

Adjust `18` in the path to match your PostgreSQL version.

### 5. Migrations

```powershell
cd backend
.venv\Scripts\python.exe -m alembic upgrade head
```

This creates 19 tables and seeds a default board named **Personal**. You should see 14 migrations run, ending at `014_task_recurrence`.

---

## Running the app

```powershell
powershell -ExecutionPolicy Bypass -File scripts\start.ps1
```

This opens two windows — backend and frontend. To stop everything cleanly:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\stop.ps1
```

Closing the windows alone is not always enough — see the port note in [Troubleshooting](#troubleshooting).

Or start each by hand, in two terminals:

```powershell
# Terminal 1 - backend
cd backend
.venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

```powershell
# Terminal 2 - frontend
cd frontend
npm run dev
```

| | URL |
|---|---|
| App | http://localhost:3000 |
| API | http://localhost:8000 |
| Interactive API docs | http://localhost:8000/docs |
| Health check | http://localhost:8000/api/v1/health |

> **Always start uvicorn from inside `backend\`.** `app/core/config.py` loads `.env` relative to the *current working directory*, not the package directory. Launched from the repo root, the backend silently falls back to its built-in defaults and will fail to reach your database.

The first page load takes ~15 seconds while Next.js compiles. Subsequent loads are fast.

### First run

There are no user accounts after a fresh install. Open http://localhost:3000, register an account, and you'll land on the seeded **Personal** board.

---

## Configuration

### `backend/.env`

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgresql://todo:todo@127.0.0.1:5432/daily_todo` | Main database connection. |
| `TEST_DATABASE_URL` | `...:5432/daily_todo_test` | Used by pytest. **Must differ from `DATABASE_URL`** — the suite wipes whatever it points at. |
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:3012` | Comma-separated. The backend rejects mutating requests whose `Origin` header isn't listed. |
| `UPLOAD_DIR` | `uploads` | Attachment storage, relative to `backend/`. |
| `MAX_UPLOAD_BYTES` | `10485760` | 10 MB per attachment. |
| `PUBLIC_BASE_URL` | `http://localhost:8000` | Used to build absolute URLs. |
| `ENVIRONMENT` | `development` | Setting `production` turns on secure cookies. |
| `COOKIE_SECURE` | unset | Overrides the above. Only enable when serving over HTTPS. |
| `SESSION_TTL_DAYS` | `30` | Session lifetime. |

**If your PostgreSQL uses a non-default port**, change it in `DATABASE_URL` *and* `TEST_DATABASE_URL`. Check with:

```powershell
netstat -ano -p tcp | Select-String "LISTENING" | Select-String ":543"
```

**If you change the frontend port**, add the new origin to `CORS_ORIGINS` or every save will fail with `403 Invalid origin`.

### `frontend/.env.local`

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend base URL, no trailing slash. |

This file is optional — the fallback in `src/lib/api-client.ts` is the same value.

### Security model

The API uses cookie sessions with two layers of CSRF defence, which is worth knowing about because it shapes what a manual `curl` needs:

- **Origin check** — every mutating request must carry an `Origin` header listed in `CORS_ORIGINS`, else `403 Invalid origin`.
- **CSRF token** — mutating requests must also send `X-CSRF-Token`, fetched from `GET /api/v1/auth/csrf`, else `403 CSRF check failed`.

Browsers set `Origin` automatically; `curl` does not. To hit the API by hand:

```powershell
curl -X POST http://127.0.0.1:8000/api/v1/tasks `
  -H "Origin: http://localhost:3000" `
  -H "X-CSRF-Token: <token from /auth/csrf>" `
  -H "Content-Type: application/json" `
  -b cookies.txt -d "{...}"
```

---

## How offline vendoring works

Two vendored dependency stores make a network-free install possible.

### `backend/packages/` — Python wheels (~9 MB)

39 pre-built `.whl` files covering `requirements.txt` and every transitive dependency, for CPython 3.11 on 64-bit Windows.

To refresh them **on a machine with internet**:

```powershell
cd backend
pip download -r requirements.txt -d packages --platform win_amd64 --python-version 311 --only-binary=:all:
```

### `frontend/vendor/npm-cache/` — npm cache

An npm content-addressable cache holding the tarball for every package in `package-lock.json`. It is *not* a `node_modules` folder — `npm ci --offline` unpacks it into `node_modules` at install time.

This is preferable to copying `node_modules` directly: it is roughly half the size, verified against the lockfile's integrity hashes, and reproduces a clean install rather than a snapshot of one machine's state.

To refresh it **on a machine with internet**:

```powershell
cd frontend
npm ci --cache .\vendor\npm-cache
```

Re-run that whenever `package.json` or `package-lock.json` changes, otherwise the offline install will fail on the missing package.

---

## Moving the project to another machine

Copy the whole project folder, **including these normally-ignored directories**:

| Path | Include? | Why |
|---|---|---|
| `backend/packages/` | **Yes** | Offline Python wheels. Untracked by git. |
| `frontend/vendor/npm-cache/` | **Yes** | Offline npm cache. Untracked by git. |
| `backend/.venv/` | No | Contains absolute paths to this machine. Recreate it on the target. |
| `frontend/node_modules/` | No | Rebuilt from the vendored cache. |
| `frontend/.next/`, `.next-dev/` | No | Build output. |
| `backend/.env` | Optional | Recreated from `.env.example` by the setup script. |
| `backend/uploads/` | Only to keep attachments | Your uploaded files live here. |

> **A `git clone` is not enough.** `backend/packages/` and `frontend/vendor/npm-cache/` are untracked, so cloning gives you a project that cannot be installed offline. Copy the folder — via USB drive, for example — rather than cloning.

Then on the target machine:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
```

To bring your existing data across as well, dump it on the source machine and restore on the target:

```powershell
# Source
& "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" -h 127.0.0.1 -U todo -d daily_todo -Fc -f daily_todo.dump

# Target (after setup.ps1 has created the database)
& "C:\Program Files\PostgreSQL\18\bin\pg_restore.exe" -h 127.0.0.1 -U todo -d daily_todo --clean --if-exists daily_todo.dump
```

Copy `backend/uploads/` across too, or attachments will 404.

---

## Troubleshooting

**`password authentication failed for user "todo"`**
The role doesn't exist yet, or its password isn't `todo`. Redo [step 4](#4-database). To reset an existing role: `ALTER ROLE todo WITH PASSWORD 'todo';`

**`connection refused` on port 5432**
PostgreSQL isn't running: `Get-Service *postgres*`, then `Start-Service postgresql-x64-18`. If it's running on a different port, update `DATABASE_URL`.

**`ERROR: Could not find a version that satisfies the requirement ...`**
pip fell through to the network and found nothing. Either you're not on Python 3.11, or a wheel is missing from `backend/packages/`. Confirm with `python --version`.

**`npm ci` fails with `ENOTCACHED` or a registry timeout**
The vendored cache doesn't match `package-lock.json`. Refresh it on a networked machine (see [above](#how-offline-vendoring-works)).

**`403 Invalid origin` on every save**
The frontend's origin isn't in `CORS_ORIGINS`. If you moved the frontend off port 3000, add the new origin to `backend/.env` and restart the backend.

**Backend starts but can't reach the database, despite a correct `.env`**
You started uvicorn from the wrong directory. `.env` is read relative to the working directory — `cd backend` first.

**Port 3000 or 8000 stays occupied after closing the window**
Run `scripts\stop.ps1`.

Both servers spawn a worker that inherits the listening socket: `uvicorn --reload` forks a reloader child, and `npm run dev` spawns `next dev`. Closing the terminal kills the parent but not the worker, which keeps holding the port. Worse, `netstat` keeps reporting the *dead parent's* PID — so the obvious fix fails:

```powershell
netstat -ano -p tcp | Select-String ":8000.*LISTENING"   # shows PID 16428
Stop-Process -Id 16428 -Force                            # "process does not exist"
```

`scripts\stop.ps1` walks the process tree and kills the actual holder. To do it by hand, find the orphan by its parent PID:

```powershell
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'parent_pid=16428' } |
    Select-Object ProcessId, CommandLine
Stop-Process -Id <that PID> -Force
```

**`alembic upgrade head` says the target database is not up to date**
Check current state with `.venv\Scripts\python.exe -m alembic current`. A fresh database should reach `014_task_recurrence`.

---

## API reference

All routes are under `/api/v1`. Every endpoint except `/health`, `/auth/register`, `/auth/login` and `/auth/csrf` requires an authenticated session.

### Auth
| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/register` | Create an account. Body: `email`, `password`, `display_name`. |
| `POST` | `/auth/login` | Start a session. |
| `POST` | `/auth/logout` | End the session. |
| `GET` | `/auth/me` | Current user. |
| `GET` | `/auth/csrf` | Fetch a CSRF token. |

### Boards
| Method | Path | Description |
|---|---|---|
| `GET` | `/boards` | List boards with task counts. |
| `POST` | `/boards` | Create a board with default statuses and an Uncategorized category. |
| `GET` | `/boards/{id}` | Board metadata. |
| `PATCH` | `/boards/{id}` | Update name, color, icon, timezone. |
| `PATCH` | `/boards/{id}/reorder` | Reorder active boards. |
| `POST` | `/boards/{id}/archive` · `/restore` | Archive or restore (data is kept). |
| `DELETE` | `/boards/{id}` | Delete permanently. |
| `GET` | `/boards/{id}/view?date=` | Columns and tasks for a day. |
| `GET` | `/boards/{id}/categories` · `/columns` | Board's categories / columns. |

### Tasks
| Method | Path | Description |
|---|---|---|
| `POST` | `/tasks` | Create. Requires `board_id`, `column_id`, `title`, `due_date`, `category_id`. |
| `GET` `PATCH` `DELETE` | `/tasks/{id}` | Read, update, delete. |
| `PATCH` | `/tasks/{id}/move` | Transactional reorder / column move. |
| `PATCH` | `/tasks/{id}/subtasks/{subtask_id}` · `/subtasks/reorder` | Subtask edits. |
| `GET` | `/tasks/{id}/attachments/{attachment_id}/download` | Download an attachment. |

`category_id` is required and may not be null — fetch a valid one from `/boards/{id}/categories` first.

Move body:

```json
{ "target_column_id": "uuid", "target_position": 2, "expected_version": 4 }
```

Returns `409` when `expected_version` is stale.

### Columns, recurrence, and the rest
| Method | Path | Description |
|---|---|---|
| `PATCH` | `/columns/{id}` · `/reorder` | Update or reorder a status column. |
| `POST` | `/columns/{id}/archive` · `/restore` | Archive or restore a status. |
| `GET` | `/task-recurrence` · `/{series_id}` | List or read recurring series. |
| `PATCH` | `/task-recurrence/{series_id}` | Edit a series. |
| `POST` | `/task-recurrence/{series_id}/stop` · `/resume` · `/generate` | Series lifecycle. |
| `GET` `POST` | `/notes`, `/notes/{id}` | Notepad CRUD. |
| `GET` `POST` | `/schedule`, `/schedule/{id}` | Schedule entries. |
| `PUT` | `/schedule/{id}/occurrences/{date}` | Mark one occurrence complete. |
| `GET` | `/today` | Today view. |
| `GET` | `/dashboard/summary` | Dashboard counts. |
| `GET` | `/health` | Health check. |

---

## Tests

### Backend

Tests require a dedicated database and never fall back to `DATABASE_URL`. `TEST_DATABASE_URL` must point at a different database, which `scripts\setup.ps1` creates for you.

```powershell
cd backend
.venv\Scripts\python.exe -m pytest -q
```

### Frontend

```powershell
cd frontend
npx vitest run
npx tsc --noEmit    # typecheck - currently clean
```

---

## Known issues

Both of these are pre-existing and affect **tests only** — the app itself runs correctly.

**53 backend recurrence tests fail on hardcoded dates.** The failures are confined to `test_recurrence_edit_scopes.py`, `test_recurrence_delete_scopes.py`, `test_recurrence_series_management.py`, `test_recurrence_series_edit.py` and `test_task_recurrence.py`. Those tests pin absolute dates (`date(2026, 8, 21)`, `date(2026, 1, 2)`, …) while the service materializes occurrences into a rolling window of `today → today + 62 days` (`HORIZON_DAYS` in `app/services/recurrence_service.py`). Once real-world "today" moves past the pinned dates, the expected occurrences fall outside the window and never get generated. The pure date-math tests in `test_recurrence_dates.py` all pass, which confirms the recurrence logic itself is sound — the fixtures are simply stale. Fixing this means making the tests freeze "today" relative to their fixtures rather than pinning literals.

**The frontend Vitest suite cannot start — the test toolchain requires Node 22+.** All 51 test files fail before a single test runs, with `TypeError: webidl.util.markAsUncloneable is not a function` thrown from `undici` while `jsdom` loads it. `npm ci` states the cause outright:

```
npm warn EBADENGINE package: 'jsdom@30.0.1'
npm warn EBADENGINE required: { node: '^22.22.2 || ^24.15.0 || >=26.0.0' }
npm warn EBADENGINE current:  { node: 'v20.19.5' }
```

`jsdom@30`, `undici@8` and `@testing-library/jest-dom@7` all declare Node 22+. Only the *test* dependencies are affected — Next.js, React and every runtime package install and run correctly on Node 20, and `npx tsc --noEmit` passes clean.

Two ways out, both needing a networked machine: upgrade to Node 22 LTS (then re-vendor the npm cache), or pin `jsdom` to v26 and `@testing-library/jest-dom` to v6, which still support Node 20.
