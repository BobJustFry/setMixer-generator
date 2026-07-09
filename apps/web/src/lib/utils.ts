import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatFileSize(bytes: bigint | number | null | undefined): string {
  if (!bytes) return "—";
  const n = Number(bytes);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: "Ожидание",
    scanning: "Сканирование",
    analyzing: "Анализ",
    ready_for_review: "На проверке",
    rendering: "Рендер",
    ready: "Готово",
    failed: "Ошибка",
    draft: "Черновик",
    scheduled: "Запланировано",
    uploading: "Загрузка",
    processing: "Обработка",
    published: "Опубликовано",
  };
  return map[status] || status;
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    pending: "text-warm-300",
    analyzing: "text-blue-400",
    ready_for_review: "text-accent",
    rendering: "text-blue-400",
    ready: "text-green-400",
    failed: "text-red-400",
    scheduled: "text-accent",
    uploading: "text-blue-400",
    published: "text-green-400",
  };
  return map[status] || "text-warm-300";
}
