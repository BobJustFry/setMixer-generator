import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { getSessionOptions, type SessionData } from "@/lib/session";
import { verifyAppPassword, isAppPasswordConfigured } from "@/lib/auth-password";
import {
  AUTH_MAX_ATTEMPTS,
  clearAuthFailures,
  getAuthRateLimitState,
  recordAuthFailure,
} from "@/lib/auth-rate-limit";
import { getClientIp } from "@/lib/client-ip";

export async function POST(request: NextRequest) {
  if (!isAppPasswordConfigured()) {
    return NextResponse.json(
      { error: "Пароль приложения не настроен (APP_PASSWORD)" },
      { status: 503 }
    );
  }

  const ip = getClientIp(request);
  const rate = await getAuthRateLimitState(ip);
  if (rate.locked) {
    return NextResponse.json(
      {
        error: `Слишком много попыток. Повторите через ${Math.ceil(rate.retryAfterSec / 60)} мин.`,
        retryAfterSec: rate.retryAfterSec,
      },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const password = body.password?.trim() || "";
  if (!password) {
    return NextResponse.json({ error: "Введите пароль" }, { status: 400 });
  }

  if (!verifyAppPassword(password)) {
    const afterFail = await recordAuthFailure(ip);
    const remaining = Math.max(0, AUTH_MAX_ATTEMPTS - afterFail.attempts);
    if (afterFail.locked) {
      return NextResponse.json(
        {
          error: `Неверный пароль. Доступ временно заблокирован на ${Math.ceil(afterFail.retryAfterSec / 60)} мин.`,
          retryAfterSec: afterFail.retryAfterSec,
        },
        { status: 429, headers: { "Retry-After": String(afterFail.retryAfterSec) } }
      );
    }
    return NextResponse.json(
      {
        error: `Неверный пароль${remaining > 0 ? `. Осталось попыток: ${remaining}` : ""}`,
        remainingAttempts: remaining,
      },
      { status: 401 }
    );
  }

  await clearAuthFailures(ip);

  const response = NextResponse.json({ ok: true });
  const session = await getIronSession<SessionData>(
    request,
    response,
    getSessionOptions()
  );
  session.isLoggedIn = true;
  await session.save();
  return response;
}
