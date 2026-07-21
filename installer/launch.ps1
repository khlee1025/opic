param(
  [switch]$UseSource
)

$ErrorActionPreference = "Stop"
$appUrl = "http://127.0.0.1:4273"
$healthUrl = "$appUrl/api/health"
$runtimeRoot = Join-Path $env:LOCALAPPDATA "OPIc-Daily-Coach"
$installedAppRoot = Join-Path $runtimeRoot "app"
$sourceAppRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$installedServerEntry = Join-Path $installedAppRoot "local-launcher\server.mjs"
$sourceServerEntry = Join-Path $sourceAppRoot "local-launcher\server.mjs"

if ($UseSource -and (Test-Path -LiteralPath $sourceServerEntry -PathType Leaf)) {
  $appRoot = $sourceAppRoot
} elseif (Test-Path -LiteralPath $installedServerEntry -PathType Leaf) {
  $appRoot = $installedAppRoot
} else {
  $appRoot = $sourceAppRoot
}

$serverEntry = Join-Path $appRoot "local-launcher\server.mjs"
$logsRoot = Join-Path $runtimeRoot "logs"
$mutex = [Threading.Mutex]::new($false, "Local\OPIcDailyCoach-Launcher")
$hasMutex = $false

function Show-LauncherMessage([string]$message) {
  try {
    $shell = New-Object -ComObject WScript.Shell
    $null = $shell.Popup($message, 12, "OPIc Daily Coach", 48)
  } catch {
    # A notification failure must not expose or log learner answers.
  }
}

function Get-CoachHealth {
  try {
    return Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 2
  } catch {
    return $null
  }
}

function Test-CoachPort {
  $client = [Net.Sockets.TcpClient]::new()
  try {
    $task = $client.ConnectAsync("127.0.0.1", 4273)
    return $task.Wait(500) -and $client.Connected
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

function Open-Coach {
  Start-Process $appUrl
}

try {
  $hasMutex = $mutex.WaitOne(0)
  if (-not $hasMutex) {
    return
  }

  $health = Get-CoachHealth
  if ($health.service -eq "opic-daily-coach" -and $health.privacy -eq "local-only") {
    Open-Coach
    return
  }

  if (Test-CoachPort) {
    Show-LauncherMessage "4273 포트를 다른 프로그램이 사용 중이라 OPIc Daily Coach를 시작하지 못했습니다."
    return
  }

  if (-not (Test-Path -LiteralPath $serverEntry -PathType Leaf)) {
    Show-LauncherMessage "앱 실행 파일을 찾지 못했습니다. 설치 폴더를 다시 확인해 주세요."
    return
  }

  if ($appRoot -eq $sourceAppRoot) {
    $sourceBuildEntries = @(
      (Join-Path $appRoot "server.js"),
      (Join-Path $appRoot "dist\server\index.js")
    )
    if (-not ($sourceBuildEntries | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf })) {
      Show-LauncherMessage "소스 빌드가 없습니다. 먼저 installer\setup-source.ps1을 실행해 주세요."
      return
    }
  }

  $pathNode = Get-Command node.exe -ErrorAction SilentlyContinue
  $nodeCandidates = @(
    (Join-Path $runtimeRoot "runtime\node\node.exe")
  )
  if ($pathNode) { $nodeCandidates += $pathNode.Source }
  $nodeCandidates += "C:\Program Files\nodejs\node.exe"
  $nodeExe = $nodeCandidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
  if (-not $nodeExe) {
    Show-LauncherMessage "로컬 실행 엔진(Node.js)을 찾지 못했습니다."
    return
  }

  New-Item -ItemType Directory -Path $logsRoot -Force | Out-Null
  $stdoutLog = Join-Path $logsRoot "server-output.log"
  $stderrLog = Join-Path $logsRoot "server-error.log"
  $process = Start-Process -FilePath $nodeExe `
    -ArgumentList @($serverEntry) `
    -WorkingDirectory $appRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog `
    -PassThru
  Set-Content -LiteralPath (Join-Path $runtimeRoot "server.pid") -Value $process.Id -Encoding ascii

  $frontendReady = $false
  for ($attempt = 0; $attempt -lt 120; $attempt += 1) {
    Start-Sleep -Milliseconds 500
    if ($process.HasExited) { break }

    $health = Get-CoachHealth
    if ($health.service -ne "opic-daily-coach" -or $health.privacy -ne "local-only") {
      continue
    }

    try {
      $page = Invoke-WebRequest -Uri $appUrl -Method Get -TimeoutSec 2
      $frontendReady = $page.StatusCode -eq 200 -and $page.Content -match "OPIc Daily Coach"
    } catch {
      $frontendReady = $false
    }

    if ($frontendReady -and $health.mode -eq "local-model") {
      Open-Coach
      return
    }
  }

  if ($frontendReady -and $health.service -eq "opic-daily-coach") {
    Open-Coach
    Show-LauncherMessage "앱은 열렸지만 로컬 AI가 아직 준비 중입니다. 잠시 뒤 상태가 자동으로 갱신됩니다."
    return
  }

  Show-LauncherMessage "앱 시작 시간이 초과되었습니다. logs 폴더의 시작 로그를 확인해 주세요."
} catch {
  Show-LauncherMessage "앱을 시작하지 못했습니다. 설치 상태를 다시 확인해 주세요."
} finally {
  if ($hasMutex) {
    $mutex.ReleaseMutex()
  }
  $mutex.Dispose()
}
