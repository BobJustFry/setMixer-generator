import { timingSafeEqual } from "crypto";

export function isAppPasswordConfigured(): boolean {
  return Boolean(process.env.APP_PASSWORD?.trim());
}

export function verifyAppPassword(password: string): boolean {
  const expected = process.env.APP_PASSWORD?.trim();
  if (!expected) return false;

  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}
