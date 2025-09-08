Param(
  [int]$BackendPort = 8000,
  [int]$FrontendPort = 5173,
  [switch]$KillRange
)

Write-Host "[DEV] Spinning up StudentPilot full stack (Backend=$BackendPort Frontend=$FrontendPort)" -ForegroundColor Cyan

# Start backend in background
$backendParams = @{ Port = $BackendPort; Background = $true }
if ($KillRange) { $backendParams.KillRange = $true }
Write-Host "[DEV] Launching backend..." -ForegroundColor DarkCyan
./start_backend.ps1 @backendParams

# Wait for health (give process a moment to spawn)
$healthUrl = "http://127.0.0.1:$BackendPort/health"
Start-Sleep -Milliseconds 400
$healthy = $false
for ($i=0; $i -lt 60; $i++) {
  try {
    $resp = Invoke-WebRequest -UseBasicParsing $healthUrl -TimeoutSec 2
    if ($resp.StatusCode -eq 200) {
      Write-Host "[DEV] Backend healthy: $($resp.Content)" -ForegroundColor Green
      $healthy = $true
      break
    }
  } catch {
    Start-Sleep -Milliseconds 250
  }
  if ($i -in 5,10,20,30,40,50) { Write-Host "[DEV] Waiting for backend... ($i)" -ForegroundColor DarkGray }
}
if (-not $healthy) {
  Write-Host "[DEV] Backend health check failed after retries" -ForegroundColor Red
  exit 1
}

# Set VITE_API_BASE so frontend points to backend
$env:VITE_API_BASE = "http://127.0.0.1:$BackendPort"
Write-Host "[DEV] Starting frontend (port $FrontendPort) ..." -ForegroundColor DarkCyan

# Run npm dev (inherits env); this blocks until user stops it.
npm run dev
