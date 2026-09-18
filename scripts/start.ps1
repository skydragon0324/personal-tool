<#
.SYNOPSIS
    Start the backend and frontend dev servers.
.DESCRIPTION
    Opens the FastAPI backend (port 8000) and the Next.js frontend (port 3000)
    in two separate PowerShell windows. Close those windows to stop the servers.
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\start.ps1
#>
[CmdletBinding()]
param(
    [int]$BackendPort  = 8000,
    [int]$FrontendPort = 3000
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$backend  = Join-Path $repoRoot 'backend'
$frontend = Join-Path $repoRoot 'frontend'

$venvPython = Join-Path $backend '.venv\Scripts\python.exe'
if (-not (Test-Path $venvPython)) {
    throw 'backend\.venv not found. Run scripts\setup.ps1 first.'
}
if (-not (Test-Path (Join-Path $frontend 'node_modules'))) {
    throw 'frontend\node_modules not found. Run scripts\setup.ps1 first.'
}
if (-not (Test-Path (Join-Path $backend '.env'))) {
    throw 'backend\.env not found. Run scripts\setup.ps1 first.'
}

function Test-PortInUse($port) {
    $conns = netstat -ano -p tcp | Select-String -Pattern ":$port\s.*LISTENING"
    return [bool]$conns
}

foreach ($p in @($BackendPort, $FrontendPort)) {
    if (Test-PortInUse $p) {
        throw "Port $p is already in use. Stop whatever is listening on it, or pass -BackendPort / -FrontendPort."
    }
}

# uvicorn must run with backend\ as the working directory: app\core\config.py
# loads .env relative to the current directory, not the package.
Start-Process powershell -ArgumentList @(
    '-NoExit', '-Command',
    "Set-Location '$backend'; & '$venvPython' -m uvicorn app.main:app --reload --port $BackendPort"
)
Write-Host "Backend  -> http://localhost:$BackendPort  (docs at /docs)" -ForegroundColor Green

Start-Process powershell -ArgumentList @(
    '-NoExit', '-Command',
    "Set-Location '$frontend'; npm run dev -- --port $FrontendPort"
)
Write-Host "Frontend -> http://localhost:$FrontendPort" -ForegroundColor Green

Write-Host "`nTwo windows opened. Close them to stop the servers." -ForegroundColor DarkGray
Write-Host "The frontend takes ~15s to compile on first load." -ForegroundColor DarkGray
