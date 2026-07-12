/** YouTube scheduled publish must be at least this far in the future. */
export const YOUTUBE_SCHEDULE_MIN_LEAD_MS = 15 * 60 * 1000;

export function parsePublishAt(input: string | null | undefined): Date | null {
  if (!input?.trim()) return null;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function validateYouTubePublishAt(
  publishAt: Date | null,
  now = new Date()
): string | null {
  if (!publishAt) return null;
  const min = new Date(now.getTime() + YOUTUBE_SCHEDULE_MIN_LEAD_MS);
  if (publishAt.getTime() < min.getTime()) {
    const mins = YOUTUBE_SCHEDULE_MIN_LEAD_MS / 60_000;
    return `Дата публикации должна быть минимум на ${mins} минут позже текущего времени`;
  }
  return null;
}

/** Minimum value for `<input type="datetime-local">` in the user's local timezone. */
export function datetimeLocalMinValue(now = new Date()): string {
  const min = new Date(now.getTime() + YOUTUBE_SCHEDULE_MIN_LEAD_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${min.getFullYear()}-${pad(min.getMonth() + 1)}-${pad(min.getDate())}T${pad(min.getHours())}:${pad(min.getMinutes())}`;
}

/** Convert datetime-local field value to UTC ISO string for the API. */
export function datetimeLocalToIso(value: string): string | null {
  if (!value.trim()) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
