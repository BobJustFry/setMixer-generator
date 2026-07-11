# HTTPS с доменом (Caddy + Let's Encrypt)

Доступ по `https://ytb.gnh-nur.ru` **без порта :3000**. Сертификат выдаёт Let's Encrypt автоматически через [Caddy](https://caddyserver.com/).

> **Почему не `https://домен:3000`?**  
> Бесплатные сертификаты (Let's Encrypt) выдаются только на стандартные порты **80** (проверка домена) и **443** (HTTPS). На `:3000` валидный HTTPS без своего сертификата не настроить.

## Что нужно

1. DNS: запись **A** `ytb.gnh-nur.ru` → ваш **внешний** IP (не `127.0.0.1` в публичном DNS).
2. Роутер: проброс **TCP 80** и **TCP 443** на IP вашего ПК в LAN.
3. Windows Firewall: разрешить входящие 80 и 443 (Docker обычно создаёт правила сам).
4. Файл `Caddyfile` в корне проекта (уже есть для `ytb.gnh-nur.ru`).

Порт **3000** наружу можно **убрать** — Caddy проксирует на контейнер `web` внутри Docker.

---

## Быстрый запуск (Windows)

### 1. App URL в `.env`

```env
NEXT_PUBLIC_APP_URL=https://ytb.gnh-nur.ru
```

Перезапуск контейнеров подхватит значение. То же значение укажите в **Настройки → App URL** в интерфейсе.

### 2. Запуск с HTTPS

```powershell
cd P:\Projects\setmixer.generator
docker compose -f docker-compose.yml -f docker-compose.https.yml up -d --build
```

Или скрипт:

```powershell
.\scripts\https-up.ps1
```

### 3. Проверка

- Откройте **https://ytb.gnh-nur.ru** (без `:3000`).
- Первый запуск: Caddy запросит сертификат (10–60 сек). Логи: `docker compose -f docker-compose.yml -f docker-compose.https.yml logs -f caddy`.

Локально по-прежнему работает **http://localhost:3000** — если нужен только localhost, запускайте без `docker-compose.https.yml`.

---

## YouTube OAuth

В [Google Cloud Console](https://console.cloud.google.com/auth/clients) добавьте:

| Поле | Значение |
|------|----------|
| JavaScript origins | `https://ytb.gnh-nur.ru` |
| Redirect URI | `https://ytb.gnh-nur.ru/api/youtube/callback` |

Старые `http://...:3000` можно оставить для локальной разработки или удалить.

В SetMixer: **Настройки → App URL** = `https://ytb.gnh-nur.ru` → **Сохранить** → заново **Авторизоваться в Google**.

---

## Вернуться на HTTP :3000

```powershell
docker compose -f docker-compose.yml -f docker-compose.https.yml down
docker compose up -d
```

На роутере снова пробросьте 3000, если нужен доступ из интернета по HTTP.

---

## Устранение проблем

### «Сертификат не выдаётся» / ERR_SSL

- Проверьте с телефона **без Wi‑Fi** (мобильный интернет): `https://ytb.gnh-nur.ru` должен открываться.
- Убедитесь, что **80 и 443** проброшены на **тот же ПК**, где Docker.
- DNS: `nslookup ytb.gnh-nur.ru` должен показывать ваш внешний IP.
- Логи Caddy: ошибки `acme` / `connection refused` → порт 80 не доходит до ПК.
- Некоторые провайдеры блокируют **входящий 80** — тогда Let's Encrypt HTTP-проверка не пройдёт; нужен VPS или Cloudflare Tunnel.

### «hosts» только на вашем ПК

Если `ytb.gnh-nur.ru` прописан в `C:\Windows\System32\drivers\etc\hosts` как `127.0.0.1`, с других устройств домен не откроется. Для доступа из интернета нужна **публичная A-запись** у регистратора DNS.

### Порт 80 занят (IIS, Skype)

Освободите 80 или остановите конфликтующий сервис. Caddy должен слушать 80 для автоматического HTTPS.

### ComfyUI

Не меняется: worker ходит на `host.docker.internal:8000`. ComfyUI не нужно выставлять в интернет.

---

## Файлы

| Файл | Назначение |
|------|------------|
| `Caddyfile` | Домен и reverse proxy → `web:3000` |
| `docker-compose.https.yml` | Сервис Caddy, закрытие порта 3000 наружу |
| `scripts/https-up.ps1` | Запуск одной командой |

Другой домен: отредактируйте `Caddyfile` (см. `Caddyfile.example`).
