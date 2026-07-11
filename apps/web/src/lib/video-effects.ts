export const VIDEO_EFFECTS = [
  {
    id: "none",
    label: "Без эффекта",
    description: "Чистое видео без постобработки фона",
  },
  {
    id: "film_grain",
    label: "Зерно плёнки",
    description: "Живое киношное зерно — шум меняется каждый кадр",
  },
  {
    id: "heavy_grain",
    label: "Грубое зерно",
    description: "Выраженное зерно старой плёнки с движением",
  },
  {
    id: "vintage_film",
    label: "Винтаж",
    description: "Сепия и виньетка + живое зерно плёнки",
  },
  {
    id: "8mm",
    label: "8mm",
    description: "Домашнее кино: зерно и мерцание яркости",
  },
  {
    id: "vhs",
    label: "VHS",
    description: "Помехи, scanlines и дрожание как у видеомагнитофона",
  },
  {
    id: "analog",
    label: "Аналог",
    description: "Зерно и лёгкое движение текстуры",
  },
  {
    id: "horror",
    label: "Хоррор",
    description: "Холодный тон и пульсирующее зерно",
  },
  {
    id: "glitch",
    label: "Глитч",
    description: "Случайные вспышки помех и сдвиг цвета",
  },
  {
    id: "flicker",
    label: "Мерцание",
    description: "Лёгкое мерцание яркости как у проектора",
  },
] as const;

export type VideoEffect = (typeof VIDEO_EFFECTS)[number]["id"];

export const DEFAULT_VIDEO_EFFECT: VideoEffect = "none";

const VALID_IDS = new Set(VIDEO_EFFECTS.map((e) => e.id));

export function parseVideoEffect(raw: unknown): VideoEffect {
  if (typeof raw === "string" && VALID_IDS.has(raw as VideoEffect)) {
    return raw as VideoEffect;
  }
  return DEFAULT_VIDEO_EFFECT;
}

export function videoEffectLabel(id: string): string {
  const effect = VIDEO_EFFECTS.find((e) => e.id === id);
  return effect?.label ?? "Без эффекта";
}
