import { getRedisConnection } from "./queue";

const FAIL_PREFIX = "auth:fail:";
const LOCK_PREFIX = "auth:lock:";

export const AUTH_MAX_ATTEMPTS = 5;
export const AUTH_WINDOW_SEC = 30 * 60;
export const AUTH_LOCKOUT_SEC = 30 * 60;

export interface AuthRateLimitState {
  locked: boolean;
  attempts: number;
  retryAfterSec: number;
}

function failKey(ip: string) {
  return `${FAIL_PREFIX}${ip}`;
}

function lockKey(ip: string) {
  return `${LOCK_PREFIX}${ip}`;
}

export async function getAuthRateLimitState(ip: string): Promise<AuthRateLimitState> {
  const redis = getRedisConnection();
  const [lockTtl, attemptsRaw] = await Promise.all([
    redis.ttl(lockKey(ip)),
    redis.get(failKey(ip)),
  ]);

  if (lockTtl > 0) {
    return {
      locked: true,
      attempts: AUTH_MAX_ATTEMPTS,
      retryAfterSec: lockTtl,
    };
  }

  const attempts = Number(attemptsRaw || 0);
  return { locked: false, attempts, retryAfterSec: 0 };
}

export async function recordAuthFailure(ip: string): Promise<AuthRateLimitState> {
  const redis = getRedisConnection();
  const key = failKey(ip);
  const attempts = await redis.incr(key);
  if (attempts === 1) {
    await redis.expire(key, AUTH_WINDOW_SEC);
  }

  if (attempts >= AUTH_MAX_ATTEMPTS) {
    await redis.set(lockKey(ip), "1", "EX", AUTH_LOCKOUT_SEC);
    return {
      locked: true,
      attempts,
      retryAfterSec: AUTH_LOCKOUT_SEC,
    };
  }

  return { locked: false, attempts, retryAfterSec: 0 };
}

export async function clearAuthFailures(ip: string): Promise<void> {
  const redis = getRedisConnection();
  await redis.del(failKey(ip), lockKey(ip));
}
