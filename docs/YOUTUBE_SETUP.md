# Локальный запуск

Приложение работает на `http://localhost:3000` на вашем ПК.

**Важно:** YouTube и Replicate не подключаются к вашему компьютеру как к серверу:
- **YouTube OAuth** — редирект идёт в ваш браузер на App URL (localhost достаточно)
- **Replicate** — worker опрашивает API (polling), webhook не используются
- **Загрузка на YouTube** — исходящие запросы с ПК

Проброс порта **3000** на роутере нужен только при доступе с другого устройства или App URL с LAN/внешним IP. В **Настройках** → «Определить IP» → подставить нужный адрес.

## Кратко

1. [Google Cloud Console](https://console.cloud.google.com/) → проект
2. Включить [YouTube Data API v3](https://console.cloud.google.com/apis/library/youtube.googleapis.com)
3. [OAuth consent screen](https://console.cloud.google.com/auth/audience) → External, scopes upload + readonly, **Test users** = ваш email
4. [OAuth Client](https://console.cloud.google.com/auth/clients) → Web application:
   - **JavaScript origins:** `http://localhost:3000`
   - **Redirect URI:** `http://localhost:3000/api/youtube/callback`
5. Импорт JSON или Client ID + Secret → **Сохранить и проверить** → **Авторизоваться в Google**

Значения Origin и Redirect URI копируются из формы настроек — они зависят от поля **App URL**.

## Важно

- **Client Secret** Google показывает только при создании client — сохраните JSON сразу
- Изменения в Google Console могут применяться **5 минут — несколько часов**
- В режиме **Testing** только email из Test users может авторизоваться
- Redirect URI должен совпадать **буквально** (http/https, порт, без лишнего слэша)

## Отложенная публикация

- Видимость: «Приватное»
- Укажите дату — YouTube опубликует автоматически

## Квоты

YouTube Data API: ~10 000 units/день (~6 загрузок видео в день).

---

# Replicate (AI-обложки)

Токен в **Настройки** → Replicate → **(i)**.

1. https://replicate.com → регистрация
2. Billing при необходимости
3. API Tokens → Create token → `r8_...`
4. **Сохранить и проверить**

Без токена: тёмный/градиентный фон, AI недоступен.
