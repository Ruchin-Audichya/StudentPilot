Param(
  [int]$Port = 8011,
  [switch]$Background,
  [switch]$KillRange
)

# Ensure we are executing inside the backend directory (script's own path)
if ($PSScriptRoot -and (Get-Location).Path -ne $PSScriptRoot) {
  Set-Location $PSScriptRoot
}

Write-Host "[START] Activating venv..."
if (-not (Test-Path .venv\Scripts\Activate.ps1)) {
  python -m venv .venv
}
. .venv\Scripts\Activate.ps1

Write-Host "[START] Installing deps (skip if already) ..."
pip install -q -r requirements.txt

# Load .env manually for safety (python-dotenv will also load) – ignore if missing
if (Test-Path .env) {
  Get-Content .env | ForEach-Object {
    if ($_ -match '^(#|\s*$)') { return }
    $k,$v = $_.Split('=',2)
    if ($k) { Set-Item -Path Env:$k -Value $v }
  }
} else {
  Write-Host "[INFO] No local .env file found (skipping manual load)" -ForegroundColor DarkGray
}

# Optionally kill a range of common dev ports
if ($KillRange) {
  Write-Host "[CLEAN] Scanning ports 8000-8030..." -ForegroundColor DarkCyan
  foreach ($p in 8000..8030) {
    $procs = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($pid in $procs) {
      try {
        Write-Host ("[CLEAN] Killing PID {0} on port {1}" -f $pid, $p) -ForegroundColor Yellow
        Stop-Process -Id $pid -Force -ErrorAction Stop
      } catch {
        $msg = $_.Exception.Message
        Write-Host ("[CLEAN] Failed to kill PID {0} on {1}: {2}" -f $pid, $p, $msg) -ForegroundColor Red
      }
    }
  }
}

# Free target port if busy
$existing = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess
if ($existing) {
  Write-Host "[START] Port $Port in use by PID $existing - stopping" -ForegroundColor Yellow
  Stop-Process -Id $existing -Force
  Start-Sleep -Milliseconds 400
}

Write-Host "[START] Launching uvicorn on 127.0.0.1:$Port (Background=$Background)" -ForegroundColor Cyan
$env:PORT = "$Port"

if ($Background) {
  # Start a detached pwsh that activates venv then runs uvicorn
  $cmd = "cd `"$PSScriptRoot`"; . .venv/Scripts/Activate.ps1; $env:PORT=$Port; uvicorn main:app --host 127.0.0.1 --port $Port"
  Start-Process pwsh -ArgumentList '-NoLogo','-NoProfile','-Command', $cmd -WindowStyle Hidden
  Write-Host "[START] Backend started in background. Use: Get-Process -Name python, then Stop-Process <PID> to stop." -ForegroundColor Green
} else {
  uvicorn main:app --host 127.0.0.1 --port $Port
}
