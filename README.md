# SetMixer Generator

Приватный генератор YouTube-видео из DJ-миксов. Работает **локально на вашем компьютере**.

Статичные/анимированные обложки, автоопределение смены треков, планирование публикации на YouTube.

## Стек

- **Next.js 15** — веб-интерфейс и API
- **PostgreSQL + Prisma** — БД, пользователи, задачи
- **Python worker** — анализ аудио (librosa), FFmpeg-рендер, YouTube upload
- **Redis** — очередь задач
- **Docker Compose** — запуск на Windows одной командой

## Быстрый старт

```powershell
copy .env.example .env
# Отредактируйте .env (ENCRYPTION_KEY, YouTube, Replicate)

docker compose up -d --build
```

Если PowerShell не находит `docker` (часто в Cursor после установки Docker Desktop) — перезапустите Cursor целиком или используйте:

```powershell
.\scripts\compose.ps1 up -d --build
```

Откройте http://localhost:3000

Подробнее: [docs/DEPLOY.md](docs/DEPLOY.md)

## YouTube OAuth

[docs/YOUTUBE_SETUP.md](docs/YOUTUBE_SETUP.md)

## Структура данных

| Путь | Назначение |
|------|------------|
| `data/mixes` | Исходные аудиофайлы миксов |
| `data/renders` | Готовые MP4 |
| `data/thumbs` | AI-обложки сегментов |

## Workflow

1. Положить миксы в `data/mixes`
2. **Миксы** → Сканировать → Создать видео
3. Дождаться анализа сегментов, при необходимости поправить таймкоды
4. Запустить рендер
5. **Расписание** → метаданные YouTube → запланировать публикацию
