[CmdletBinding()]
param(
  [switch]$NoShortcut,
  [switch]$SkipTests
)

$ErrorActionPreference = "Stop"
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$launcherPath = Join-Path $PSScriptRoot "launch.ps1"
$packageJson = Get-Content -LiteralPath (Join-Path $projectRoot "package.json") -Raw -Encoding UTF8 | ConvertFrom-Json
$appVersion = $packageJson.version
$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
$npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue

if (-not $nodeCommand -or -not $npmCommand) {
  throw "Node.js 22.13 이상을 설치한 뒤 다시 실행해 주세요."
}

$nodeVersionText = (& $nodeCommand.Source --version).Trim().TrimStart("v")
$nodeVersion = [Version]$nodeVersionText
if ($nodeVersion -lt [Version]"22.13.0") {
  throw "Node.js 22.13 이상이 필요합니다. 현재 버전: $nodeVersion"
}

function Invoke-Npm([string[]]$Arguments) {
  & $npmCommand.Source @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "npm $($Arguments -join ' ') 실행에 실패했습니다."
  }
}

Push-Location $projectRoot
try {
  Invoke-Npm @("ci")
  if (-not $SkipTests) {
    Invoke-Npm @("run", "test:unit")
  }
  Invoke-Npm @("run", "build")
} finally {
  Pop-Location
}

if (-not $NoShortcut) {
  $desktop = [Environment]::GetFolderPath("Desktop")
  $shortcutPath = Join-Path $desktop "OPIc Daily Coach.lnk"
  $powerShellExe = (Get-Command powershell.exe -ErrorAction Stop).Source
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = $powerShellExe
  $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$launcherPath`" -UseSource"
  $shortcut.WorkingDirectory = $projectRoot
  $shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,220"
  $shortcut.Description = "OPIc Daily Coach v$appVersion (local-only)"
  $shortcut.Save()
  Write-Host "바탕화면 바로가기를 만들었습니다: $shortcutPath"
}

Write-Host "OPIc Daily Coach 소스 설치가 끝났습니다."
Write-Host "실행: powershell -ExecutionPolicy Bypass -File `"$launcherPath`" -UseSource"
