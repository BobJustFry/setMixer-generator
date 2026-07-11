# Docker Compose wrapper for Windows when `docker` is not in PATH
# (e.g. Cursor was started before Docker Desktop install).

$ErrorActionPreference = "Stop"
$dockerBin = "C:\Program Files\Docker\Docker\resources\bin"
$dockerExe = Join-Path $dockerBin "docker.exe"

if ($env:PATH -notlike "*$dockerBin*") {
  $env:PATH = "$dockerBin;$env:PATH"
}

if (-not (Test-Path $dockerExe)) {
  Write-Error "Docker не найден: $dockerExe`nУстановите Docker Desktop и запустите его."
  exit 1
}

Set-Location (Join-Path $PSScriptRoot "..")
& $dockerExe compose @args
exit $LASTEXITCODE
