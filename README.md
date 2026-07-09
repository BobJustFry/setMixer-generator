# SetMixer Generator

Приватный генератор YouTube-видео из DJ-миксов. Статичные/анимированные обложки, автоопределение смены треков, планирование публикации на YouTube.

## Стек

- **Next.js 15** — веб-интерфейс и API
- **PostgreSQL + Prisma** — БД, пользователи, задачи
- **Python worker** — анализ аудио (librosa), FFmpeg-рендер, YouTube upload
- **Redis** — очередь задач
- **Docker Compose** — деплой на VPS
- **Caddy** — reverse proxy для setmixer.ru

## Быстрый старт (локально)

```bash
cp .env.example .env
# Отредактируйте .env

docker compose up -d postgres redis
cd apps/web && npm install && npx prisma migrate dev && npm run dev
# В другом терминале:
cd workers/python && pip install -r requirements.txt && python main.py
```

Откройте http://localhost:3000, войдите с ADMIN_EMAIL / ADMIN_PASSWORD из `.env`.

## Деплой на VPS

См. [docs/DEPLOY.md](docs/DEPLOY.md)

## YouTube OAuth

См. [docs/YOUTUBE_SETUP.md](docs/YOUTUBE_SETUP.md)

## Структура данных

| Путь | Назначение |
|------|------------|
| `/data/mixes` | Исходные аудиофайлы миксов |
| `/data/renders` | Готовые MP4 |
| `/data/thumbs` | AI-обложки сегментов |

## Workflow

1. Положить миксы в `/data/mixes`
2. **Миксы** → Сканировать → Создать видео
3. Дождаться анализа сегментов, при необходимости поправить таймкоды
4. Запустить рендер
5. **Расписание** → заполнить метаданные YouTube → запланировать публикацию
