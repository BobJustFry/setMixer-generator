const ERROR_MAP: Record<string, string> = {
  redirect_uri_mismatch:
    "Redirect URI не совпадает с Google Console. Скопируйте оба URI из настроек SetMixer (Origin и Redirect) в OAuth client типа Web application. Изменения в Google могут применяться до нескольких часов.",
  access_denied:
    "Доступ отклонён. Добавьте ваш Google-email в Test users на OAuth consent screen (режим Testing) или завершите настройку consent screen.",
  invalid_client:
    "Неверный Client ID или Client Secret. Проверьте значения или импортируйте JSON заново — secret показывается только при создании client.",
  unauthorized_client:
    "OAuth client не авторизован для этого типа запроса. Убедитесь, что тип приложения — Web application.",
  invalid_grant:
    "Код авторизации недействителен или истёк. Нажмите «Авторизоваться в Google» снова.",
  no_code: "Google не вернул код авторизации. Повторите подключение.",
  origin_mismatch:
    "JavaScript origin не совпадает. Добавьте Authorized JavaScript origins в Google Console (значение Origin из настроек SetMixer).",
};

export function decodeYouTubeError(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (raw === "1") return "YouTube успешно подключён";

  const lower = raw.toLowerCase();
  for (const [key, msg] of Object.entries(ERROR_MAP)) {
    if (lower.includes(key)) return msg;
  }

  if (raw.includes("Refresh token")) {
    return `${raw} Отзовите доступ приложения в https://myaccount.google.com/permissions и подключите снова.`;
  }

  return raw;
}

export function normalizeAppUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, "");
  return trimmed || "http://localhost:3000";
}

export function youtubeRedirectUri(appUrl: string): string {
  return `${normalizeAppUrl(appUrl)}/api/youtube/callback`;
}

export function youtubeJavaScriptOrigin(appUrl: string): string {
  return normalizeAppUrl(appUrl);
}
