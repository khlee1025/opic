[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$runtimeRoot = Join-Path $env:LOCALAPPDATA "OPIc-Daily-Coach"
$pidPath = Join-Path $runtimeRoot "server.pid"
$healthUrl = "http://127.0.0.1:4273/api/health"

if (-not (Test-Path -LiteralPath $pidPath -PathType Leaf)) {
  Write-Host "실행 중인 OPIc Daily Coach 정보를 찾지 못했습니다."
  return
}

$pidText = (Get-Content -LiteralPath $pidPath -Raw -Encoding ascii).Trim()
$serverProcessId = 0
if (-not [int]::TryParse($pidText, [ref]$serverProcessId) -or $serverProcessId -le 0) {
  throw "server.pid 값이 올바르지 않아 아무 프로세스도 종료하지 않았습니다."
}

try {
  $health = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 2
} catch {
  throw "로컬 OPIc 서비스 확인에 실패해 PID $serverProcessId 프로세스를 종료하지 않았습니다."
}

if ($health.service -ne "opic-daily-coach" -or $health.privacy -ne "local-only") {
  throw "4273 포트가 OPIc Daily Coach인지 확인할 수 없어 종료하지 않았습니다."
}

$process = Get-Process -Id $serverProcessId -ErrorAction SilentlyContinue
if (-not $process -or $process.ProcessName -ne "node") {
  throw "기록된 PID가 실행 중인 OPIc Node 프로세스와 일치하지 않아 종료하지 않았습니다."
}

$taskkill = Join-Path $env:SystemRoot "System32\taskkill.exe"
try {
  & $taskkill /PID "$serverProcessId" /T /F 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "taskkill exit $LASTEXITCODE"
  }
} catch {
  # Some Windows policies deny taskkill /T even when the verified root
  # process may be stopped. The local model exits when its parent pipe closes.
  Stop-Process -Id $serverProcessId -Force -ErrorAction Stop
}

$deadline = (Get-Date).AddSeconds(5)
do {
  $remaining = Get-Process -Id $serverProcessId -ErrorAction SilentlyContinue
  if (-not $remaining) { break }
  Start-Sleep -Milliseconds 200
} while ((Get-Date) -lt $deadline)

if ($remaining) {
  throw "OPIc Daily Coach 프로세스를 종료하지 못했습니다."
}

Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
Write-Host "OPIc Daily Coach와 로컬 자식 프로세스를 종료했습니다."
