<#
.SYNOPSIS
    Stop the backend and frontend dev servers.
.DESCRIPTION
    Frees ports 8000 and 3000, including the orphaned child processes that
    `uvicorn --reload` and `npm run dev` leave behind when their parent shell
    is closed.

    Both spawn a worker that inherits the listening socket. Killing the parent
    leaves that worker holding the port, and netstat keeps reporting the dead
    parent's PID - so the obvious "kill the PID netstat shows" does nothing.
    This script walks the process tree instead.
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\stop.ps1
#>
[CmdletBinding()]
param(
    [int[]]$Ports = @(8000, 3000)
)

$ErrorActionPreference = 'Stop'

function Get-ListenerPids($port) {
    $lines = netstat -ano -p tcp | Select-String ":$port\s.*LISTENING"
    $found = @()
    foreach ($line in $lines) {
        $found += [int](($line -split '\s+')[-1])
    }
    return $found | Sort-Object -Unique
}

function Stop-TreeForPort($port) {
    $listeners = Get-ListenerPids $port
    if (-not $listeners) {
        Write-Host "  port $port already free" -ForegroundColor DarkGray
        return
    }

    foreach ($listenerPid in $listeners) {
        # Children first: a live child keeps the socket open even once the
        # parent is gone, which is what leaves the port stuck.
        $children = Get-CimInstance Win32_Process -Filter "ParentProcessId=$listenerPid" -ErrorAction SilentlyContinue
        foreach ($child in $children) {
            $proc = Get-Process -Id $child.ProcessId -ErrorAction SilentlyContinue
            if ($proc) {
                Write-Host "  stopping child $($proc.ProcessName) (PID $($child.ProcessId))" -ForegroundColor Yellow
                Stop-Process -Id $child.ProcessId -Force -ErrorAction SilentlyContinue
            }
        }

        $parent = Get-Process -Id $listenerPid -ErrorAction SilentlyContinue
        if ($parent) {
            Write-Host "  stopping $($parent.ProcessName) (PID $listenerPid)" -ForegroundColor Yellow
            Stop-Process -Id $listenerPid -Force -ErrorAction SilentlyContinue
        } else {
            # netstat is reporting a dead parent; the socket belongs to an
            # orphan that was re-parented. Find it by command line.
            Write-Host "  PID $listenerPid is gone - searching for the orphan holding port $port" -ForegroundColor DarkGray
            $orphans = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
                $_.CommandLine -and (
                    $_.CommandLine -match "parent_pid=$listenerPid" -or
                    $_.CommandLine -match 'uvicorn'                 -or
                    $_.CommandLine -match 'next(-router)?-worker'   -or
                    $_.CommandLine -match 'next\b.*dev'
                )
            }
            foreach ($orphan in $orphans) {
                Write-Host "  stopping orphan PID $($orphan.ProcessId)" -ForegroundColor Yellow
                Stop-Process -Id $orphan.ProcessId -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

Write-Host "Stopping servers..." -ForegroundColor Cyan
foreach ($port in $Ports) { Stop-TreeForPort $port }

Start-Sleep -Seconds 3

$stuck = @()
foreach ($port in $Ports) {
    if (Get-ListenerPids $port) { $stuck += $port }
}

if ($stuck) {
    Write-Host "`nStill in use: $($stuck -join ', ')" -ForegroundColor Red
    Write-Host 'A socket can linger for a few seconds after its process exits. Re-run if it persists.'
    exit 1
}

Write-Host "`nAll ports free." -ForegroundColor Green
