# Reset stuck background tasks and restart worker

$ErrorActionPreference = "Stop"
$dockerBin = "C:\Program Files\Docker\Docker\resources\bin"
if ($env:PATH -notlike "*$dockerBin*") {
  $env:PATH = "$dockerBin;$env:PATH"
}

Write-Host "Restarting worker..." -ForegroundColor Yellow
docker restart setmixergenerator-worker-1 | Out-Null

Write-Host "Cancelling stuck tasks in DB..." -ForegroundColor Yellow
Get-Content (Join-Path $PSScriptRoot "cancel-stuck.sql") -Raw | docker exec -i setmixergenerator-postgres-1 psql -U setmixer -d setmixer

Write-Host "Done. Refresh browser (Ctrl+F5)." -ForegroundColor Green
