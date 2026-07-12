import { getIronSession, SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  isLoggedIn: boolean;
}

function sessionSecret(): string {
  const secret =
    process.env.SESSION_SECRET?.trim() ||
    process.env.ENCRYPTION_KEY?.trim() ||
    "";
  if (secret.length >= 32) return secret;
  if (process.env.NODE_ENV !== "production") {
    return "dev-only-session-secret-32chars!!";
  }
  throw new Error("SESSION_SECRET or ENCRYPTION_KEY must be at least 32 characters");
}

let cachedOptions: SessionOptions | null = null;

export function getSessionOptions(): SessionOptions {
  if (!cachedOptions) {
    cachedOptions = {
      password: sessionSecret(),
      cookieName: "setmixer_session",
      cookieOptions: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
      },
    };
  }
  return cachedOptions;
}

/** @deprecated use getSessionOptions() — kept for typing in iron-session calls */
export const sessionOptions = {
  get password() {
    return getSessionOptions().password;
  },
  get cookieName() {
    return getSessionOptions().cookieName;
  },
  get cookieOptions() {
    return getSessionOptions().cookieOptions;
  },
} as SessionOptions;

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), getSessionOptions());
}
