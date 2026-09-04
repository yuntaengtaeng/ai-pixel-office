$ErrorActionPreference = "SilentlyContinue"

for ($attempt = 0; $attempt -lt 60; $attempt++) {
  $web = Invoke-WebRequest -Uri "http://localhost:47371/" -UseBasicParsing -TimeoutSec 1
  $api = Invoke-RestMethod -Uri "http://127.0.0.1:47372/health" -TimeoutSec 1
  if (
    $web.StatusCode -eq 200 -and
    $web.Content -match "AI Pixel Office" -and
    $api.status -eq "ok"
  ) {
    Start-Process "http://localhost:47371/"
    exit 0
  }
  Start-Sleep -Milliseconds 500
}

exit 1
