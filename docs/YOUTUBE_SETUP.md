# Настройка YouTube API

## 1. Google Cloud Console

1. Откройте https://console.cloud.google.com/
2. Создайте проект (или выберите существующий)
3. **APIs & Services** → **Enable APIs** → включите **YouTube Data API v3**

## 2. OAuth consent screen

1. **APIs & Services** → **OAuth consent screen**
2. User Type: **External**
3. Заполните название приложения
4. Scopes: добавьте `youtube.upload` и `youtube.readonly`
5. Test users: добавьте ваш Google-аккаунт (email канала YouTube)

## 3. Credentials

1. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**
2. Application type: **Web application**
3. Authorized redirect URIs:
   - `https://setmixer.ru/api/youtube/callback`
   - (для локальной разработки) `http://localhost:3000/api/youtube/callback`
4. Скопируйте **Client ID** и **Client Secret** в `.env`:

```env
YOUTUBE_CLIENT_ID=your-client-id.apps.googleusercontent.com
YOUTUBE_CLIENT_SECRET=your-client-secret
YOUTUBE_REDIRECT_URI=https://setmixer.ru/api/youtube/callback
```

## 4. Подключение в приложении

1. Откройте https://setmixer.ru/settings
2. Нажмите **Подключить YouTube**
3. Разрешите доступ аккаунту канала

## 5. Отложенная публикация

- Установите **Видимость**: «Приватное»
- Укажите **Дату публикации** — YouTube опубликует автоматически
- Видео загружается сразу, публикация — по расписанию

## Квоты

YouTube Data API: ~10 000 units/день. Одна загрузка ≈ 1600 units (~6 видео/день).
При превышении квоты загрузка вернёт ошибку — повторите на следующий день.

## AI-обложки (опционально)

Для генерации обложек через Replicate:

1. Зарегистрируйтесь на https://replicate.com
2. Создайте API token
3. Добавьте в `.env`:

```env
REPLICATE_API_TOKEN=r8_...
```

Без токена используются градиентные placeholder-обложки.
