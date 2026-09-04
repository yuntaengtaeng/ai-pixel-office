$ErrorActionPreference = "Stop"
$utf8Encoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = $utf8Encoding
[Console]::OutputEncoding = $utf8Encoding
$OutputEncoding = $utf8Encoding
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot

if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js 22.18 이상을 먼저 설치해 주세요." -ForegroundColor Red
  exit 1
}

function Test-DependenciesReady {
  if (-not (Test-Path -LiteralPath (Join-Path $projectRoot "node_modules"))) {
    return $false
  }
  & node.exe --input-type=module -e "Promise.all([import('better-sqlite3'), import('vite')]).catch(() => process.exit(1))" 2>$null
  return $LASTEXITCODE -eq 0
}

if (-not (Test-DependenciesReady)) {
  Write-Host "처음 실행에 필요한 패키지를 설치합니다..." -ForegroundColor Cyan
  & npm.cmd ci --ignore-scripts --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

function Test-ApiRunning {
  try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:47372/health" -TimeoutSec 1
    return $health.status -eq "ok"
  } catch { return $false }
}

function Test-WebRunning {
  try {
    $page = Invoke-WebRequest -Uri "http://localhost:47371/" -UseBasicParsing -TimeoutSec 1
    return $page.StatusCode -eq 200 -and $page.Content -match "AI Pixel Office"
  } catch { return $false }
}

$apiRunning = Test-ApiRunning
$webRunning = Test-WebRunning
if ($apiRunning -and $webRunning) {
  Write-Host "AI Pixel Office가 이미 실행 중입니다." -ForegroundColor Green
  Start-Process "http://localhost:47371/"
  exit 0
}

$browserHelper = Join-Path $PSScriptRoot "open-office-browser.ps1"
Start-Process powershell.exe -WindowStyle Hidden -ArgumentList @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-File", ('"' + $browserHelper + '"')
)

Write-Host "AI Pixel Office를 시작합니다. 이 창을 닫으면 앱도 종료됩니다." -ForegroundColor Green
if ($apiRunning) {
  Write-Host "기존 API 서버를 사용합니다." -ForegroundColor DarkGray
  & npm.cmd run dev:web
} elseif ($webRunning) {
  Write-Host "기존 웹 서버를 사용합니다." -ForegroundColor DarkGray
  & npm.cmd start
} else {
  & npm.cmd run office
}

exit $LASTEXITCODE
