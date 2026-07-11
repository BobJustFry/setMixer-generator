# Запуск SetMixer с HTTPS (Caddy + Let's Encrypt)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

if (-not (Test-Path "Caddyfile")) {
    Write-Host "Caddyfile не найден. Скопируйте Caddyfile.example и укажите домен." -ForegroundColor Yellow
    exit 1
}

Write-Host "Проверьте на роутере проброс TCP 80 и 443 на этот ПК." -ForegroundColor Cyan
Write-Host "App URL: https://ytb.gnh-nur.ru:3000 (YouTube OAuth)" -ForegroundColor Cyan
Write-Host ""

docker compose -f docker-compose.yml -f docker-compose.https.yml up -d --build

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Готово. Откройте https://ytb.gnh-nur.ru:3000" -ForegroundColor Green
    Write-Host "Логи Caddy: docker compose -f docker-compose.yml -f docker-compose.https.yml logs -f caddy"
}
