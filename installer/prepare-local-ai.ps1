[CmdletBinding()]
param(
  [ValidateSet("qwen3.5:9b", "qwen3.5:4b")]
  [string]$Model = "qwen3.5:9b",
  [switch]$CheckOnly
)

$ErrorActionPreference = "Stop"
$runtimeRoot = Join-Path $env:LOCALAPPDATA "OPIc-Daily-Coach"
$modelsRoot = Join-Path $runtimeRoot "models"
$logsRoot = Join-Path $runtimeRoot "logs"
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$ollamaCandidates = @(
  $env:OLLAMA_EXE,
  (Join-Path $runtimeRoot "engine\ollama\ollama.exe"),
  (Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama.exe"),
  (Join-Path $env:ProgramFiles "Ollama\ollama.exe"),
  (Join-Path $repoRoot "runtime\ollama\ollama.exe")
) | Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Leaf) }
$ollamaExe = $ollamaCandidates | Select-Object -First 1

if (-not $ollamaExe) {
  throw "Ollama를 찾지 못했습니다. Ollama를 설치한 뒤 다시 실행하거나 OLLAMA_EXE 환경변수에 ollama.exe 경로를 지정해 주세요."
}

New-Item -ItemType Directory -Path $modelsRoot, $logsRoot -Force | Out-Null
$env:OLLAMA_HOST = "127.0.0.1:11435"
$env:OLLAMA_MODELS = $modelsRoot
$env:OLLAMA_NO_CLOUD = "1"
$env:OLLAMA_CONTEXT_LENGTH = "4096"
$env:OLLAMA_FLASH_ATTENTION = "1"
$env:OLLAMA_KV_CACHE_TYPE = "q8_0"

function Get-OllamaTags {
  try {
    return Invoke-RestMethod -Uri "http://127.0.0.1:11435/api/tags" -Method Get -TimeoutSec 2
  } catch {
    return $null
  }
}

$startedProcess = $null
try {
  $tags = Get-OllamaTags
  if (-not $tags) {
    $startedProcess = Start-Process -FilePath $ollamaExe `
      -ArgumentList @("serve") `
      -WorkingDirectory (Split-Path -Parent $ollamaExe) `
      -WindowStyle Hidden `
      -RedirectStandardOutput (Join-Path $logsRoot "ollama-setup-output.log") `
      -RedirectStandardError (Join-Path $logsRoot "ollama-setup-error.log") `
      -PassThru

    for ($attempt = 0; $attempt -lt 40; $attempt += 1) {
      Start-Sleep -Milliseconds 250
      $tags = Get-OllamaTags
      if ($tags) { break }
      if ($startedProcess.HasExited) { break }
    }
  }

  if (-not $tags) {
    throw "로컬 Ollama 엔진을 127.0.0.1:11435에서 시작하지 못했습니다."
  }

  $installedModels = @($tags.models | ForEach-Object { $_.name })
  if ($CheckOnly) {
    if ($installedModels -contains $Model) {
      Write-Host "로컬 AI 준비됨: $Model"
      return
    }
    throw "로컬 엔진은 실행되지만 $Model 모델이 없습니다. -CheckOnly 없이 다시 실행해 설치하세요."
  }

  & $ollamaExe pull $Model
  if ($LASTEXITCODE -ne 0) {
    throw "$Model 모델 설치에 실패했습니다."
  }
  Write-Host "로컬 AI 준비가 끝났습니다: $Model"
  Write-Host "모델 저장 위치: $modelsRoot"
} finally {
  if ($startedProcess -and -not $startedProcess.HasExited) {
    Stop-Process -Id $startedProcess.Id -ErrorAction SilentlyContinue
  }
}
