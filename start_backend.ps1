<#
 Root helper script to start the FastAPI backend quickly from repo root.
 Wraps backend/start_local.ps1 (which handles venv, deps, .env loading, port cleanup).

 Usage examples (PowerShell):
	 ./start_backend.ps1                 # starts on default port 8011 in foreground
	 ./start_backend.ps1 -Port 8000      # custom port
	 ./start_backend.ps1 -Background     # start detached (use Get-Process python to find)
	 ./start_backend.ps1 -KillRange      # free ports 8000-8030 first

 Parameters map directly to backend/start_local.ps1.
#>
Param(
	[int]$Port = 8011,
	[switch]$Background,
	[switch]$KillRange
)

$ErrorActionPreference = 'Stop'

$backendScript = Join-Path $PSScriptRoot 'backend' 'start_local.ps1'
if (-not (Test-Path $backendScript)) {
	Write-Host "[ERROR] Cannot locate backend/start_local.ps1 (looked at $backendScript)" -ForegroundColor Red
	exit 1
}

Write-Host "[INFO] Starting backend via backend/start_local.ps1 (Port=$Port, Background=$Background, KillRange=$KillRange)" -ForegroundColor Cyan

# Splat parameters for clarity
$argsHash = @{ Port = $Port }
if ($Background) { $argsHash.Background = $true }
if ($KillRange) { $argsHash.KillRange = $true }

& $backendScript @argsHash

if (-not $Background) {
	Write-Host "[INFO] Backend stopped (foreground mode)." -ForegroundColor Yellow
} else {
	Write-Host "[INFO] Backend launched in background. Hit http://127.0.0.1:$Port/health" -ForegroundColor Green
}
