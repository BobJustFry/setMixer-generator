# Деплой SetMixer Generator на VPS

## Требования

- VPS с Docker и Docker Compose
- Caddy (уже установлен для setmixer.ru)
- Домен setmixer.ru указывает на VPS

## Шаги

### 1. Клонировать репозиторий

```bash
cd /opt
git clone https://github.com/BobJustFry/setMixer-generator.git setmixer-generator
cd setmixer-generator
```

### 2. Настроить окружение

```bash
cp .env.example .env
nano .env
```

Обязательно измените:

- `SESSION_SECRET` — случайная строка 64+ символов
- `ENCRYPTION_KEY` — случайная строка 32+ символов
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — ваш логин
- `NEXT_PUBLIC_APP_URL=https://setmixer.ru`
- `YOUTUBE_REDIRECT_URI=https://setmixer.ru/api/youtube/callback`

### 3. Запустить сервисы

```bash
docker compose up -d --build
```

Проверка:

```bash
docker compose ps
docker compose logs -f web
```

### 4. Настроить Caddy

Добавьте в Caddyfile (см. `Caddyfile.example`):

```caddy
setmixer.ru {
    reverse_proxy localhost:3000
}
```

Перезагрузите Caddy:

```bash
sudo systemctl reload caddy
```

### 5. Загрузить миксы

```bash
# Скопировать файлы на сервер
scp *.mp3 user@vps:/opt/setmixer-generator/data/mixes/

# Или rsync
rsync -av ./mixes/ user@vps:/opt/setmixer-generator/data/mixes/
```

### 6. Первый вход

Откройте https://setmixer.ru и войдите с учётными данными из `.env`.

## Обновление

```bash
cd /opt/setmixer-generator
git pull
docker compose up -d --build
```

## Логи

```bash
docker compose logs -f web      # Next.js
docker compose logs -f worker   # Python worker
docker compose logs -f postgres
```

## Бэкап

Рекомендуется бэкапить:

- Volume `postgres_data` (БД)
- Папку `/opt/setmixer-generator/data` (миксы и рендеры)
