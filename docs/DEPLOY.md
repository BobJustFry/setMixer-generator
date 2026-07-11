# Локальный запуск SetMixer Generator

Генератор работает на вашем компьютере. Доступ только у вас — через `http://localhost:3000`. VPS, домен и Caddy не нужны.

## Требования

- **Windows 10/11**
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (рекомендуется)
- Или: Node.js 20+, Python 3.12+, FFmpeg (для гибридного запуска)

## Способ 1: Всё в Docker (рекомендуется)

### 1. Клонировать и настроить

```powershell
cd P:\Projects
git clone https://github.com/BobJustFry/setMixer-generator.git setmixer.generator
cd setmixer.generator
copy .env.example .env
notepad .env
```

В `.env` обязательно измените:

- `ENCRYPTION_KEY` — случайная строка 32+ символов (для YouTube OAuth токенов)

Остальное для локального запуска уже настроено:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Redirect URI для YouTube задаётся через **App URL** в интерфейсе настроек (`{App URL}/api/youtube/callback`), не через отдельную переменную окружения.

### 2. Запустить

```powershell
docker compose up -d --build
```

Первый запуск займёт несколько минут (сборка образов).

### 3. Открыть приложение

http://localhost:3000

Приложение открывается сразу, без входа — доступ только с вашего компьютера.

### 4. Миксы

Скопируйте аудиофайлы в папку `data\mixes\`:

```
setmixer.generator\
  data\
    mixes\       ← сюда .mp3, .wav, .flac и т.д.
    renders\     ← готовые видео появятся здесь
    thumbs\      ← обложки сегментов
```

В интерфейсе: **Миксы** → **Сканировать**.

### 5. Остановка и перезапуск

```powershell
docker compose down          # остановить
docker compose up -d         # запустить снова
docker compose logs -f web   # логи веб-приложения
docker compose logs -f worker # логи рендера
```

### 6. Обновление

```powershell
git pull
docker compose up -d --build
```

---

## Способ 2: Гибрид (Docker только для БД)

Если хотите запускать web и worker напрямую на Windows (удобно для отладки).

### 1. Postgres и Redis в Docker

В `docker-compose.yml` для postgres и redis должны быть порты `5432` и `6379` (уже добавлены).

```powershell
docker compose up -d postgres redis
```

### 2. Web (Next.js)

```powershell
cd apps\web
npm install
copy ..\..\.env.example ..\..\.env
# В .env укажите:
# DATABASE_URL=postgresql://setmixer:setmixer@localhost:5432/setmixer?schema=public
# REDIS_URL=redis://localhost:6379
# DATA_DIR=P:\Projects\setmixer.generator\data

npx prisma migrate dev
npm run dev
```

### 3. Worker (Python)

Нужны FFmpeg и Python-зависимости:

```powershell
cd workers\python
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
# Те же DATABASE_URL, REDIS_URL, DATA_DIR в .env или переменных окружения
python main.py
```

---

## YouTube OAuth

См. [YOUTUBE_SETUP.md](YOUTUBE_SETUP.md). URI для Google Console берите из **Настройки** (поля Origin и Redirect URI).

Для локального запуска обычно:

- JavaScript origin: `http://localhost:3000`
- Redirect URI: `http://localhost:3000/api/youtube/callback`

## AI-обложки (ComfyUI)

Локальная генерация через ComfyUI на вашем ПК. См. [COMFYUI_SETUP.md](COMFYUI_SETUP.md).

URL по умолчанию для Docker: `http://host.docker.internal:8000`. Без ComfyUI — загрузка своих изображений или градиентный фон.

## Бэкап

Сохраняйте папку `data\` (миксы и рендеры) и volume Docker `postgres_data` (БД).

## Доступ из локальной сети (опционально)

По умолчанию приложение слушает только localhost. Если нужен доступ с другого устройства в домашней сети — можно пробросить порт `3000` в `docker-compose.yml` (уже проброшен) и открыть `http://IP-ВАШЕГО-ПК:3000`. Для безопасности не выставляйте порт наружу в интернет без VPN/файрвола.

## VPS (если понадобится позже)

Файл `Caddyfile.example` — заготовка на будущее, для локального запуска не используется.
