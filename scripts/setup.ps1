<#
.SYNOPSIS
    One-shot offline setup for the Life Management app.
.DESCRIPTION
    Installs backend and frontend dependencies from the vendored copies in this
    repository (no internet required), creates the .env files, provisions the
    PostgreSQL role and databases, and runs the migrations.

    Safe to re-run: every step checks whether it has already been done.
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
#>
[CmdletBinding()]
param(
    # Skip database provisioning (use when the role and databases already exist).
    [switch]$SkipDatabase
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$backend  = Join-Path $repoRoot 'backend'
$frontend = Join-Path $repoRoot 'frontend'

function Write-Step($text) { Write-Host "`n=== $text ===" -ForegroundColor Cyan }
function Write-Ok($text)   { Write-Host "  [ok] $text" -ForegroundColor Green }
function Write-Skip($text) { Write-Host "  [skip] $text" -ForegroundColor DarkGray }
function Write-Warn($text) { Write-Host "  [warn] $text" -ForegroundColor Yellow }

# ---------------------------------------------------------------------------
# 0. Prerequisites
# ---------------------------------------------------------------------------
Write-Step 'Checking prerequisites'

$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) { throw 'Python not found on PATH. Install Python 3.11 (64-bit) and re-run.' }
$pyVersion = (& python --version 2>&1).ToString()
if ($pyVersion -notmatch '3\.11\.') {
    throw "Found '$pyVersion' but the vendored wheels in backend\packages are built for Python 3.11 (64-bit). Install Python 3.11, or re-vendor the wheels on a machine with internet."
}
Write-Ok $pyVersion

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { throw 'Node.js not found on PATH. Install Node.js 20 and re-run.' }
Write-Ok "Node $(& node --version)"

# psql is only needed for database provisioning, and is often not on PATH.
$psql = $null
$psqlCmd = Get-Command psql -ErrorAction SilentlyContinue
if ($psqlCmd) {
    $psql = $psqlCmd.Source
} else {
    $candidates = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\psql.exe' -ErrorAction SilentlyContinue |
                  Sort-Object FullName -Descending
    if ($candidates) { $psql = $candidates[0].FullName }
}
if ($psql) { Write-Ok "psql at $psql" } else { Write-Warn 'psql not found - the database step will be skipped.' }

# ---------------------------------------------------------------------------
# 1. Environment files
# ---------------------------------------------------------------------------
Write-Step 'Creating environment files'

$backendEnv = Join-Path $backend '.env'
if (Test-Path $backendEnv) {
    Write-Skip 'backend\.env already exists (left untouched)'
} else {
    Copy-Item (Join-Path $backend '.env.example') $backendEnv
    Write-Ok 'backend\.env created from .env.example'
}

$frontendEnv = Join-Path $frontend '.env.local'
if (Test-Path $frontendEnv) {
    Write-Skip 'frontend\.env.local already exists (left untouched)'
} else {
    Copy-Item (Join-Path $frontend '.env.example') $frontendEnv
    Write-Ok 'frontend\.env.local created from .env.example'
}

# ---------------------------------------------------------------------------
# 2. Backend dependencies (offline, from backend\packages)
# ---------------------------------------------------------------------------
Write-Step 'Installing backend dependencies (offline)'

$venvPython = Join-Path $backend '.venv\Scripts\python.exe'
if (-not (Test-Path $venvPython)) {
    & python -m venv (Join-Path $backend '.venv')
    if ($LASTEXITCODE -ne 0) { throw 'Failed to create the virtual environment.' }
    Write-Ok 'Created backend\.venv'
} else {
    Write-Skip 'backend\.venv already exists'
}

& $venvPython -m pip install --no-index --find-links (Join-Path $backend 'packages') -r (Join-Path $backend 'requirements.txt') --quiet
if ($LASTEXITCODE -ne 0) { throw 'Offline pip install failed. Check that backend\packages contains a wheel for every entry in requirements.txt.' }
Write-Ok 'Backend dependencies installed from backend\packages'

# ---------------------------------------------------------------------------
# 3. Frontend dependencies (offline, from frontend\vendor\npm-cache)
# ---------------------------------------------------------------------------
Write-Step 'Installing frontend dependencies (offline)'

$npmCache = Join-Path $frontend 'vendor\npm-cache'
if (-not (Test-Path $npmCache)) {
    throw "Vendored npm cache not found at $npmCache. On a machine with internet run 'npm ci --cache .\vendor\npm-cache' inside frontend\, then copy the folder across."
}

Push-Location $frontend
try {
    & npm ci --offline --cache $npmCache
    if ($LASTEXITCODE -ne 0) { throw 'Offline npm ci failed. The vendored cache may not match this package-lock.json.' }
} finally {
    Pop-Location
}
Write-Ok 'Frontend dependencies installed from the vendored cache'

# ---------------------------------------------------------------------------
# 4. Database + 5. Migrations
# ---------------------------------------------------------------------------
if ($SkipDatabase -or -not $psql) {
    Write-Step 'Database'
    Write-Skip 'Skipped. Create the role and databases by hand, then run the migrations (see README).'
} else {
    Write-Step 'Provisioning the database'
    Write-Host '  The todo role and the daily_todo / daily_todo_test databases must be'
    Write-Host '  created by a superuser. Enter the password for the postgres user.'
    Write-Host '  (Leave blank to skip this step.)'

    $secure = Read-Host '  postgres password' -AsSecureString
    $bstr   = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $pgPass = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

    if ([string]::IsNullOrWhiteSpace($pgPass)) {
        Write-Skip 'No password entered - database step skipped.'
    } else {
        $env:PGPASSWORD = $pgPass
        try {
            $roleExists = & $psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='todo'"
            if ($LASTEXITCODE -ne 0) { throw 'Could not connect to PostgreSQL as postgres. Check the password, and that the service is running on port 5432.' }

            if ($roleExists -eq '1') {
                Write-Skip 'Role todo already exists'
            } else {
                & $psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 -c "CREATE ROLE todo WITH LOGIN PASSWORD 'todo' CREATEDB;" | Out-Null
                Write-Ok 'Created role todo'
            }

            foreach ($dbName in @('daily_todo', 'daily_todo_test')) {
                $dbExists = & $psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$dbName'"
                if ($dbExists -eq '1') {
                    Write-Skip "Database $dbName already exists"
                } else {
                    & $psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $dbName OWNER todo;" | Out-Null
                    Write-Ok "Created database $dbName"
                }
            }
        } finally {
            Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
        }

        Write-Step 'Running migrations'
        Push-Location $backend
        try {
            & $venvPython -m alembic upgrade head
            if ($LASTEXITCODE -ne 0) { throw 'alembic upgrade failed. Check DATABASE_URL in backend\.env.' }
        } finally {
            Pop-Location
        }
        Write-Ok 'Schema is up to date'
    }
}

Write-Host "`nSetup complete. Start the app with:" -ForegroundColor Green
Write-Host "    powershell -ExecutionPolicy Bypass -File scripts\start.ps1`n"
