export const VIDEO_EFFECTS = [
  {
    id: "none",
    label: "Без эффекта",
    description: "Чистое видео без постобработки фона",
  },
  {
    id: "film_grain",
    label: "Зерно плёнки",
    description: "Лёгкое киношное зерно",
  },
  {
    id: "heavy_grain",
    label: "Грубое зерно",
    description: "Выраженная текстура старой плёнки",
  },
  {
    id: "vignette",
    label: "Виньетка",
    description: "Затемнение по краям кадра",
  },
  {
    id: "vintage_film",
    label: "Винтаж",
    description: "Сепия, виньетка и зерно — старая киноплёнка",
  },
  {
    id: "8mm",
    label: "8mm",
    description: "Домашнее кино: тёплый тон, зерно, мерцание",
  },
  {
    id: "sepia",
    label: "Сепия",
    description: "Тёплый коричневый оттенок",
  },
  {
    id: "cinematic",
    label: "Кинематограф",
    description: "Контраст, тёплая цветокоррекция и виньетка",
  },
  {
    id: "noir",
    label: "Нуар",
    description: "Чёрно-белый с высоким контрастом",
  },
  {
    id: "vhs",
    label: "VHS",
    description: "Помехи, приглушённые цвета, scanlines",
  },
  {
    id: "retro_tv",
    label: "Ретро ТВ",
    description: "Scanlines, виньетка, слегка выцветшие цвета",
  },
  {
    id: "warm_glow",
    label: "Тёплое свечение",
    description: "Мягкое тепло и лёгкая резкость",
  },
  {
    id: "cool_blue",
    label: "Холодный синий",
    description: "Синеватый кинематографический тон",
  },
  {
    id: "sunset",
    label: "Закат",
    description: "Оранжево-розовый тёплый грейд",
  },
  {
    id: "dreamy",
    label: "Мечтательный",
    description: "Лёгкое размытие и повышенная насыщенность",
  },
  {
    id: "faded",
    label: "Выцветший",
    description: "Приподнятые тени, приглушённые цвета",
  },
  {
    id: "high_contrast",
    label: "Высокий контраст",
    description: "Насыщенные тени и яркие блики",
  },
  {
    id: "bleach_bypass",
    label: "Bleach bypass",
    description: "Обесцвеченный кинематографический look",
  },
  {
    id: "analog",
    label: "Аналог",
    description: "Зерно, виньетка, слегка приглушённые цвета",
  },
  {
    id: "neon",
    label: "Неон",
    description: "Яркие цвета и повышенная резкость",
  },
  {
    id: "matrix",
    label: "Матрица",
    description: "Зеленоватый цифровой оттенок",
  },
  {
    id: "horror",
    label: "Хоррор",
    description: "Холодный, контрастный, зернистый",
  },
  {
    id: "scanlines",
    label: "Scanlines",
    description: "Горизонтальные линии как на ЭЛТ-экране",
  },
  {
    id: "chromatic",
    label: "Хроматическая аберрация",
    description: "Лёгкий RGB-сдвиг по краям",
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
