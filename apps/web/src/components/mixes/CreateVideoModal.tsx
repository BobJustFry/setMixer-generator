"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, ImagePlus, Loader2, Search, Trash2, Upload } from "lucide-react";
import { Card } from "@/components/ui";
import { LoadingButton } from "@/components/LoadingButton";
import { useTasks } from "@/components/TaskProvider";
import { BACKGROUNDS_PAGE_SIZE } from "@/lib/backgrounds-constants";
import {
  AI_PRESETS,
  DEFAULT_NEGATIVE_PROMPT,
  resolveAiPrompt,
  type AiPresetId,
} from "@/lib/ai-presets";
import {
  buildEncodeSettings,
  qualityLabel,
  resolutionToSize,
  type AudioBitrate,
  type FpsPreset,
  type ResolutionPreset,
  type VideoQuality,
} from "@/lib/encode-settings";
import {
  DEFAULT_VIDEO_EFFECT,
  VIDEO_EFFECTS,
  type VideoEffect,
} from "@/lib/video-effects";
import {
  fitModeLabel,
  imageNeedsFitChoice,
  probeImageFile,
  type ImageFitMode,
} from "@/lib/image-utils";

type BackgroundStyle = "waveform_dark" | "waveform_gradient" | "waveform_image";

interface Mix {
  id: string;
  filename: string;
  title: string | null;
}

interface MixBackground {
  id: string;
  source: string;
  label: string | null;
  coverText: string | null;
  referenceImagePath: string | null;
  status: string;
  errorMessage: string | null;
  imagePath: string | null;
  width: number;
  height: number;
  sourceWidth: number | null;
  sourceHeight: number | null;
  fitMode: string;
  seed: number | null;
  prompt: string | null;
  negativePrompt: string | null;
  createdAt: string;
}

const MAX_SEED = 2_147_483_647;
const MAX_COVER_TEXT = 80;

function defaultCoverText(mix: Mix): string {
  const raw = mix.title || mix.filename.replace(/\.[^.]+$/, "");
  return raw.trim().slice(0, MAX_COVER_TEXT);
}

function randomSeed(): number {
  return Math.floor(Math.random() * (MAX_SEED + 1));
}

/** Bottom fraction reserved for waveform overlay (matches worker layout at 1080p). */
const WAVEFORM_ZONE_RATIO = (280 + 48) / 1080;

function CoverPreview({ bg }: { bg: MixBackground | undefined }) {
  if (!bg) {
    return (
      <div className="aspect-video rounded-lg border border-dashed border-surface-border bg-black/30 flex items-center justify-center">
        <p className="text-xs text-warm-500 px-4 text-center">
          Выберите обложку в галереи или сгенерируйте новую
        </p>
      </div>
    );
  }

  if (bg.status === "generating") {
    return (
      <div className="flex gap-2 items-stretch">
        {bg.referenceImagePath && (
          <div className="w-28 shrink-0 rounded-lg overflow-hidden border border-surface-border">
            <img
              src={`/api/backgrounds/${bg.id}/reference`}
              alt=""
              className="w-full aspect-video object-cover"
            />
            <p className="text-[9px] text-center text-warm-500 py-0.5 bg-black/40">Референс</p>
          </div>
        )}
        <div className="flex-1 aspect-video rounded-lg border-2 border-accent/40 bg-surface-overlay flex flex-col items-center justify-center gap-2 min-w-0">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
          <p className="text-xs text-warm-400 px-2 text-center">
            {bg.referenceImagePath ? "Генерация по референсу…" : "Генерация обложки…"}
          </p>
        </div>
      </div>
    );
  }

  if (bg.status !== "ready" || !bg.imagePath) {
    return (
      <div className="aspect-video rounded-lg border border-red-500/30 bg-red-500/5 flex items-center justify-center px-4">
        <p className="text-xs text-red-400 text-center">
          {bg.errorMessage || "Обложка недоступна"}
        </p>
      </div>
    );
  }

  const previewUrl = `/api/backgrounds/${bg.id}?v=${encodeURIComponent(`${bg.createdAt}-${bg.status}`)}`;

  return (
    <div className="relative aspect-video rounded-lg overflow-hidden border border-surface-border bg-black group">
      <img
        src={previewUrl}
        alt=""
        className="w-full h-full object-cover"
      />
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none border-t border-white/15 bg-gradient-to-t from-black/55 via-black/20 to-transparent"
        style={{ height: `${WAVEFORM_ZONE_RATIO * 100}%` }}
      >
        <span className="absolute bottom-2 left-3 text-[10px] text-white/45 tracking-wide uppercase">
          Waveform
        </span>
      </div>
      <a
        href={previewUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-2 right-2 p-1.5 rounded-md bg-black/55 text-warm-300 hover:text-warm-100 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Открыть в полном размере"
        onClick={(e) => e.stopPropagation()}
      >
        <ExternalLink className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}

function PendingCoverPreview({ file }: { file: File }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  if (!url) return null;

  return (
    <div className="relative aspect-video rounded-lg overflow-hidden border border-amber-500/40 bg-black">
      <img src={url} alt="" className="w-full h-full object-cover opacity-90" />
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none border-t border-white/15 bg-gradient-to-t from-black/55 via-black/20 to-transparent"
        style={{ height: `${WAVEFORM_ZONE_RATIO * 100}%` }}
      >
        <span className="absolute bottom-2 left-3 text-[10px] text-white/45 tracking-wide uppercase">
          Waveform
        </span>
      </div>
      <span className="absolute top-2 left-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/80 text-black">
        Перед загрузкой
      </span>
    </div>
  );
}

function coverMetaLine(bg: MixBackground): string {
  const parts = [
    bg.source === "ai" ? "AI" : "Загрузка",
    bg.referenceImagePath ? "референс" : null,
    bg.label || null,
    bg.coverText ? `«${bg.coverText}»` : null,
    bg.seed != null ? `seed ${bg.seed}` : null,
    bg.sourceWidth && bg.sourceHeight ? `${bg.sourceWidth}×${bg.sourceHeight}` : null,
    bg.fitMode && bg.fitMode !== "cover" ? fitModeLabel(bg.fitMode as ImageFitMode) : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

function ReferenceFilePreview({ file, onClear }: { file: File; onClear: () => void }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  if (!url) return null;

  return (
    <div className="flex gap-2 items-start">
      <div className="relative w-32 shrink-0 rounded-lg overflow-hidden border border-accent/40">
        <img src={url} alt="" className="w-full aspect-video object-cover bg-black" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-warm-300 truncate" title={file.name}>
          {file.name}
        </p>
        <p className="text-[10px] text-warm-500 mt-1">
          Будет использован как img2img-референс — форма и объекты с фото, стиль из промпта.
        </p>
        <button type="button" className="text-xs text-warm-500 hover:text-red-400 mt-2" onClick={onClear}>
          Убрать референс
        </button>
      </div>
    </div>
  );
}

type BgSourceFilter = "all" | "ai" | "upload";

interface BackgroundsResponse {
  items: MixBackground[];
  total: number;
  limit: number;
  offset: number;
}

interface PendingUpload {
  file: File;
  sourceWidth: number;
  sourceHeight: number;
}

interface CreateVideoModalProps {
  mix: Mix;
  aiAvailable: boolean;
  onClose: () => void;
  onCreated: (jobId: string) => void;
}

export function CreateVideoModal({
  mix,
  aiAvailable,
  onClose,
  onCreated,
}: CreateVideoModalProps) {
  const [background, setBackground] = useState<BackgroundStyle>("waveform_dark");
  const [backgrounds, setBackgrounds] = useState<MixBackground[]>([]);
  const [bgTotal, setBgTotal] = useState(0);
  const [bgSearch, setBgSearch] = useState("");
  const [bgSearchDebounced, setBgSearchDebounced] = useState("");
  const [bgSourceFilter, setBgSourceFilter] = useState<BgSourceFilter>("all");
  const [loadedPages, setLoadedPages] = useState(1);
  const [loadingBackgrounds, setLoadingBackgrounds] = useState(false);
  const [selectedBgId, setSelectedBgId] = useState<string | null>(null);
  const [aiPreset, setAiPreset] = useState<AiPresetId>("vinyl");
  const [aiPromptExtra, setAiPromptExtra] = useState("");
  const [aiNegativePrompt, setAiNegativePrompt] = useState(DEFAULT_NEGATIVE_PROMPT);
  const [aiCoverText, setAiCoverText] = useState(() => defaultCoverText(mix));
  const [aiReferenceFile, setAiReferenceFile] = useState<File | null>(null);
  const [aiSeedRandom, setAiSeedRandom] = useState(true);
  const [aiSeed, setAiSeed] = useState(() => randomSeed());
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [showFailedErrors, setShowFailedErrors] = useState(false);
  const [resolution, setResolution] = useState<ResolutionPreset>("1080p");
  const [fps, setFps] = useState<FpsPreset>(30);
  const [quality, setQuality] = useState<VideoQuality>("standard");
  const [audioBitrate, setAudioBitrate] = useState<AudioBitrate>(192);
  const [videoEffect, setVideoEffect] = useState<VideoEffect>(DEFAULT_VIDEO_EFFECT);
  const [creating, setCreating] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null);
  const [uploadFitMode, setUploadFitMode] = useState<ImageFitMode>("cover");
  const fileRef = useRef<HTMLInputElement>(null);
  const referenceFileRef = useRef<HTMLInputElement>(null);
  const { active, refresh: refreshTasks } = useTasks();

  useEffect(() => {
    const t = setTimeout(() => setBgSearchDebounced(bgSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [bgSearch]);

  useEffect(() => {
    setLoadedPages(1);
  }, [bgSearchDebounced, bgSourceFilter]);

  const loadBackgrounds = useCallback(async () => {
    setLoadingBackgrounds(true);
    try {
      const params = new URLSearchParams({
        limit: String(BACKGROUNDS_PAGE_SIZE * loadedPages),
        offset: "0",
      });
      if (bgSearchDebounced) params.set("q", bgSearchDebounced);
      if (bgSourceFilter !== "all") params.set("source", bgSourceFilter);

      const res = await fetch(`/api/backgrounds?${params}`);
      if (!res.ok) return;

      const data: BackgroundsResponse = await res.json();
      setBackgrounds(data.items);
      setBgTotal(data.total);

      const ready = data.items.filter((b) => b.status === "ready" && b.imagePath);
      setSelectedBgId((current) => {
        if (!current) return ready[0]?.id ?? null;
        const selected = data.items.find((b) => b.id === current);
        if (selected?.status === "generating") return current;
        if (ready.find((b) => b.id === current)) return current;
        return ready[0]?.id ?? null;
      });
    } finally {
      setLoadingBackgrounds(false);
    }
  }, [bgSearchDebounced, bgSourceFilter, loadedPages]);

  useEffect(() => {
    loadBackgrounds();
    const t = setInterval(loadBackgrounds, 3000);
    return () => clearInterval(t);
  }, [loadBackgrounds]);

  const generatingIds = new Set(
    backgrounds.filter((b) => b.status === "generating").map((b) => b.id)
  );
  const bgTask = active.find(
    (t) =>
      t.type === "generate_background" &&
      t.mixBackgroundId &&
      generatingIds.has(t.mixBackgroundId)
  );
  const hasGenerating = generatingIds.size > 0;

  async function generateAi() {
    setGenerating(true);
    setGenerateError(null);
    try {
      const prompt = resolveAiPrompt(aiPreset, aiPromptExtra);
      const fd = new FormData();
      fd.append("mixId", mix.id);
      fd.append("prompt", prompt);
      fd.append("negativePrompt", aiNegativePrompt.trim() || DEFAULT_NEGATIVE_PROMPT);
      if (aiCoverText.trim()) fd.append("coverText", aiCoverText.trim());
      fd.append("resolution", resolution);
      if (!aiSeedRandom) fd.append("seed", String(aiSeed));
      if (aiReferenceFile) fd.append("reference", aiReferenceFile);

      const res = await fetch("/api/backgrounds", {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSelectedBgId(data.id);
        setBackground("waveform_image");
        setAiReferenceFile(null);
        await refreshTasks();
        await loadBackgrounds();
      } else {
        setGenerateError(typeof data.error === "string" ? data.error : "Не удалось запустить генерацию");
      }
    } finally {
      setGenerating(false);
    }
  }

  async function uploadCover(file: File, fitMode: ImageFitMode, sourceWidth: number, sourceHeight: number) {
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("resolution", resolution);
      fd.append("fitMode", fitMode);
      fd.append("sourceWidth", String(sourceWidth));
      fd.append("sourceHeight", String(sourceHeight));
      fd.append("mixId", mix.id);
      const res = await fetch("/api/backgrounds/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSelectedBgId(data.id);
        setBackground("waveform_image");
        setPendingUpload(null);
        await loadBackgrounds();
      } else {
        setUploadError(typeof data.error === "string" ? data.error : "Не удалось загрузить изображение");
      }
    } finally {
      setUploading(false);
    }
  }

  async function handleFileSelected(file: File) {
    setUploadError(null);
    try {
      const { width: sourceWidth, height: sourceHeight } = await probeImageFile(file);
      const { width: targetW, height: targetH } = resolutionToSize(resolution);
      if (imageNeedsFitChoice(sourceWidth, sourceHeight, targetW, targetH)) {
        setUploadFitMode("cover");
        setPendingUpload({ file, sourceWidth, sourceHeight });
        return;
      }
      await uploadCover(file, "cover", sourceWidth, sourceHeight);
    } catch {
      setUploadError("Не удалось прочитать размеры изображения");
    }
  }

  async function deleteBg(bgId: string) {
    if (!confirm("Удалить обложку?")) return;
    await fetch(`/api/backgrounds/${bgId}`, { method: "DELETE" });
    if (selectedBgId === bgId) setSelectedBgId(null);
    await loadBackgrounds();
  }

  async function createJob() {
    if (background === "waveform_image" && !selectedBgId) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mixId: mix.id,
          template: background,
          backgroundId: background === "waveform_image" ? selectedBgId : undefined,
          encodeSettings: buildEncodeSettings({
            resolution,
            fps,
            quality,
            audioBitrateKbps: audioBitrate,
            videoEffect,
          }),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        await refreshTasks();
        onCreated(data.id);
      } else {
        setCreateError(typeof data.error === "string" ? data.error : "Не удалось создать видео");
      }
    } finally {
      setCreating(false);
    }
  }

  const selectedBg = backgrounds.find((b) => b.id === selectedBgId);
  const readyBackgrounds = backgrounds.filter((b) => b.status === "ready" && b.imagePath);
  const generatingBackgrounds = backgrounds.filter((b) => b.status === "generating");
  const failedBackgrounds = backgrounds.filter((b) => b.status === "failed");
  const visibleBackgrounds = [...generatingBackgrounds, ...readyBackgrounds];
  const hasMoreBackgrounds = backgrounds.length < bgTotal;
  const targetSize = resolutionToSize(resolution);

  function getCreateBlockReason(): string | null {
    if (background !== "waveform_image") return null;
    if (pendingUpload) return "Подтвердите загрузку обложки или отмените";
    if (!selectedBgId) return "Выберите или загрузите обложку";
    if (!selectedBg) return "Обложка не найдена — обновите список";
    if (selectedBg.status === "generating") return "Дождитесь окончания генерации выбранной обложки";
    if (selectedBg.status === "failed") return "Выбранная обложка с ошибкой — выберите другую";
    if (!selectedBg.imagePath) return "Файл обложки не загружен";
    return null;
  }

  const createBlockReason = getCreateBlockReason();
  const canCreate = !createBlockReason;
  const selectedEffect = VIDEO_EFFECTS.find((e) => e.id === videoEffect);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <Card className="w-full max-w-2xl p-5 shadow-xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-sm font-medium text-warm-100 mb-1">Создать видео</h3>
        <p className="text-xs text-warm-500 mb-4 truncate">{mix.title || mix.filename}</p>

        <p className="label mb-2">Фон видео</p>
        <div className="space-y-2 mb-4">
          {(
            [
              ["waveform_dark", "Тёмный", "Waveform Denon на чёрном фоне"],
              ["waveform_gradient", "Градиент", "Тёплый виниловый градиент"],
              ["waveform_image", "Своя обложка", "Общая библиотека — AI и загруженные изображения"],
            ] as const
          ).map(([value, title, desc]) => (
            <label
              key={value}
              className="flex items-start gap-3 p-3 rounded-lg border border-surface-border cursor-pointer hover:border-accent/40 transition-colors"
            >
              <input
                type="radio"
                name="bg"
                className="mt-0.5"
                checked={background === value}
                onChange={() => setBackground(value)}
              />
              <div>
                <p className="text-sm text-warm-200">{title}</p>
                <p className="text-xs text-warm-500">{desc}</p>
              </div>
            </label>
          ))}
        </div>

        {background === "waveform_image" && (
          <div className="mb-4 p-3 rounded-lg bg-surface-overlay border border-surface-border space-y-3">
            <div className="flex flex-wrap gap-2">
              <LoadingButton
                type="button"
                onClick={() => setShowAiPanel((v) => !v)}
                loading={generating}
                loadingText="Запуск..."
                variant="secondary"
                className="text-xs"
                disabled={!aiAvailable}
              >
                {hasGenerating ? "Сгенерировать AI · идёт…" : "Сгенерировать AI"}
              </LoadingButton>
              <LoadingButton
                type="button"
                onClick={() => fileRef.current?.click()}
                loading={uploading}
                loadingText="..."
                variant="secondary"
                className="text-xs"
              >
                <Upload className="w-3 h-3" />
                Загрузить
              </LoadingButton>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelected(f);
                  e.target.value = "";
                }}
              />
            </div>

            {!aiAvailable && (
              <p className="text-xs text-warm-500">AI: настройте ComfyUI в Настройках</p>
            )}

            {showAiPanel && aiAvailable && (
              <div className="space-y-2 pt-2 border-t border-surface-border">
                <p className="text-xs text-warm-500">
                  Генерация на Flux (ваша видеокарта, 1–3 мин для Dev). ComfyUI должен быть запущен.
                </p>
                <div className="flex flex-wrap gap-2">
                  {AI_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`text-xs px-2 py-1 rounded border ${
                        aiPreset === p.id ? "border-accent text-accent" : "border-surface-border text-warm-400"
                      }`}
                      onClick={() => setAiPreset(p.id)}
                    >
                      {p.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`text-xs px-2 py-1 rounded border ${
                      aiPreset === "custom" ? "border-accent text-accent" : "border-surface-border text-warm-400"
                    }`}
                    onClick={() => setAiPreset("custom")}
                  >
                    Свой
                  </button>
                </div>
                <div>
                  <label className="label text-xs">Positive prompt</label>
                  <textarea
                    className="input w-full text-xs min-h-[120px] font-mono leading-relaxed mt-1"
                    placeholder={
                      aiPreset === "custom"
                        ? "Опишите сцену целиком…"
                        : "Дополнение к пресету (необязательно)"
                    }
                    value={aiPromptExtra}
                    onChange={(e) => setAiPromptExtra(e.target.value)}
                  />
                  {aiPreset !== "custom" && (
                    <p className="text-[10px] text-warm-500 mt-1">
                      Пресет: {AI_PRESETS.find((p) => p.id === aiPreset)?.label}
                    </p>
                  )}
                  <p className="text-[10px] text-warm-500 mt-1">
                    Для персонажей: symmetrical ears, anatomically correct, detailed fur.
                  </p>
                </div>
                <div>
                  <label className="label text-xs">Negative prompt</label>
                  <textarea
                    className="input w-full text-xs min-h-[80px] font-mono leading-relaxed mt-1"
                    placeholder="Что исключить из картинки…"
                    value={aiNegativePrompt}
                    onChange={(e) => setAiNegativePrompt(e.target.value)}
                  />
                  <p className="text-[10px] text-warm-500 mt-1">
                    По умолчанию отсекаются артефакты, кривые уши, текст и водяные знаки.
                  </p>
                </div>
                <div>
                  <label className="label text-xs">Надпись на обложке</label>
                  <input
                    type="text"
                    className="input w-full text-xs mt-1"
                    placeholder="Название микса или свой текст…"
                    maxLength={MAX_COVER_TEXT}
                    value={aiCoverText}
                    onChange={(e) => setAiCoverText(e.target.value)}
                  />
                  <p className="text-[10px] text-warm-500 mt-1">
                    Наносится после AI в верхней части кадра — цвет подбирается по фону, waveform внизу
                    не перекрывается. Оставьте пустым, если надпись не нужна.
                  </p>
                </div>
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label className="label text-xs mb-0">Референс (img2img)</label>
                    {!aiReferenceFile && (
                      <button
                        type="button"
                        className="btn-secondary text-xs flex items-center gap-1"
                        onClick={() => referenceFileRef.current?.click()}
                      >
                        <ImagePlus className="w-3 h-3" />
                        Загрузить фото
                      </button>
                    )}
                  </div>
                  <input
                    ref={referenceFileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setAiReferenceFile(f);
                      e.target.value = "";
                    }}
                  />
                  {aiReferenceFile ? (
                    <ReferenceFilePreview
                      file={aiReferenceFile}
                      onClear={() => setAiReferenceFile(null)}
                    />
                  ) : (
                    <p className="text-[10px] text-warm-500">
                      Необязательно. Загрузите фото предмета, техники или персонажа — AI сохранит
                      композицию и форму, атмосферу задаст промпт. Работает с Flux и Klein.
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 text-xs text-warm-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={aiSeedRandom}
                        onChange={(e) => setAiSeedRandom(e.target.checked)}
                      />
                      Случайный seed
                    </label>
                    {!aiSeedRandom && (
                      <>
                        <input
                          type="number"
                          className="input text-xs w-36"
                          min={0}
                          max={2147483647}
                          value={aiSeed}
                          onChange={(e) => setAiSeed(Number(e.target.value))}
                        />
                        <button
                          type="button"
                          className="btn-secondary text-xs px-2"
                          title="Новый случайный seed"
                          onClick={() => setAiSeed(randomSeed())}
                        >
                          🎲
                        </button>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-warm-500">
                    Seed повторяет результат только если промпт, negative, модель и разрешение{" "}
                    <span className="text-warm-400">полностью совпадают</span>. Смена промпта — новая
                    картинка, даже с тем же seed.
                  </p>
                  {!aiSeedRandom && (
                    <p className="text-xs text-accent">
                      Фиксированный seed: {aiSeed}
                    </p>
                  )}
                  {selectedBg?.source === "ai" && selectedBg.seed != null && (
                    <button
                      type="button"
                      className="text-xs text-accent hover:underline"
                      onClick={() => {
                        setAiSeedRandom(false);
                        setAiSeed(selectedBg.seed!);
                      }}
                    >
                      Использовать seed {selectedBg.seed} с выбранной обложки
                    </button>
                  )}
                  {selectedBg?.source === "ai" && (selectedBg.prompt || selectedBg.negativePrompt) && (
                    <button
                      type="button"
                      className="text-xs text-accent hover:underline block"
                      onClick={() => {
                        if (selectedBg.prompt) {
                          setAiPreset("custom");
                          setAiPromptExtra(selectedBg.prompt);
                        }
                        if (selectedBg.negativePrompt) {
                          setAiNegativePrompt(selectedBg.negativePrompt);
                        }
                        if (selectedBg.coverText) {
                          setAiCoverText(selectedBg.coverText);
                        }
                        setShowAiPanel(true);
                      }}
                    >
                      Взять промпты с выбранной обложки
                    </button>
                  )}
                </div>
                <LoadingButton
                  type="button"
                  onClick={generateAi}
                  loading={generating}
                  loadingText="Запуск..."
                  className="text-xs"
                >
                  {hasGenerating ? "Запустить ещё одну" : "Запустить генерацию"}
                </LoadingButton>
              </div>
            )}

            {generateError && (
              <p className="text-xs text-red-400 whitespace-pre-wrap">{generateError}</p>
            )}

            {uploadError && (
              <p className="text-xs text-red-400 whitespace-pre-wrap">{uploadError}</p>
            )}

            {pendingUpload && (
              <div className="p-3 rounded-lg border border-amber-500/40 bg-amber-500/5 space-y-2">
                <p className="text-xs text-warm-200">
                  Размер изображения {pendingUpload.sourceWidth}×{pendingUpload.sourceHeight}, видео будет{" "}
                  {targetSize.width}×{targetSize.height}. Выберите, как вписать картинку:
                </p>
                <div className="space-y-1">
                  {(["cover", "stretch", "contain"] as const).map((mode) => (
                    <label key={mode} className="flex items-center gap-2 text-xs text-warm-300 cursor-pointer">
                      <input
                        type="radio"
                        name="fitMode"
                        checked={uploadFitMode === mode}
                        onChange={() => setUploadFitMode(mode)}
                      />
                      {fitModeLabel(mode)}
                    </label>
                  ))}
                </div>
                <div className="flex gap-2 pt-1">
                  <LoadingButton
                    type="button"
                    onClick={() =>
                      uploadCover(
                        pendingUpload.file,
                        uploadFitMode,
                        pendingUpload.sourceWidth,
                        pendingUpload.sourceHeight
                      )
                    }
                    loading={uploading}
                    loadingText="..."
                    className="text-xs"
                  >
                    Загрузить
                  </LoadingButton>
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    onClick={() => setPendingUpload(null)}
                    disabled={uploading}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            )}

            {(bgTask || hasGenerating) && (
              <p className="text-xs text-accent flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                {bgTask?.stageDetail || "Генерация обложки..."}
              </p>
            )}

            <div className="space-y-1.5">
              <p className="text-[10px] text-warm-500 uppercase tracking-wide">Предпросмотр</p>
              {pendingUpload ? (
                <PendingCoverPreview file={pendingUpload.file} />
              ) : (
                <CoverPreview bg={selectedBg} />
              )}
              {selectedBg && selectedBg.status === "ready" && selectedBg.imagePath && !pendingUpload && (
                <p className="text-xs text-warm-400 truncate" title={coverMetaLine(selectedBg)}>
                  {coverMetaLine(selectedBg)}
                </p>
              )}
            </div>

            <div className="space-y-2 pt-1 border-t border-surface-border">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[140px]">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-warm-500 w-3 h-3 pointer-events-none" />
                  <input
                    type="search"
                    className="input w-full text-xs pl-7"
                    placeholder="Поиск по названию или промпту…"
                    value={bgSearch}
                    onChange={(e) => setBgSearch(e.target.value)}
                  />
                </div>
                <div className="flex gap-1">
                  {(
                    [
                      ["all", "Все"],
                      ["ai", "AI"],
                      ["upload", "Загрузки"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={`text-xs px-2 py-1 rounded border ${
                        bgSourceFilter === value
                          ? "border-accent text-accent"
                          : "border-surface-border text-warm-400"
                      }`}
                      onClick={() => setBgSourceFilter(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-warm-500">
                <span>
                  {bgTotal === 0
                    ? "Нет обложек"
                    : `Показано ${visibleBackgrounds.length} из ${bgTotal}`}
                </span>
                {loadingBackgrounds && (
                  <span className="flex items-center gap-1 text-warm-400">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Обновление…
                  </span>
                )}
              </div>

              {visibleBackgrounds.length > 0 ? (
                <div className="max-h-72 overflow-y-auto rounded-lg border border-surface-border p-2">
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {generatingBackgrounds.map((bg) => (
                      <div
                        key={bg.id}
                        className={`relative rounded-lg overflow-hidden border-2 aspect-video bg-surface-overlay flex items-center justify-center cursor-pointer ${
                          selectedBgId === bg.id ? "border-accent" : "border-accent/30"
                        }`}
                        onClick={() => setSelectedBgId(bg.id)}
                      >
                        <div className="flex flex-col items-center gap-2 text-accent px-2 text-center">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span className="text-[10px] text-warm-400">Генерация…</span>
                        </div>
                        <button
                          type="button"
                          className="absolute top-1 right-1 p-1 rounded bg-black/50 text-warm-400 hover:text-red-400"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteBg(bg.id);
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {readyBackgrounds.map((bg) => (
                      <div
                        key={bg.id}
                        className={`relative rounded-lg overflow-hidden border-2 cursor-pointer ${
                          selectedBgId === bg.id ? "border-accent" : "border-transparent"
                        }`}
                        onClick={() => setSelectedBgId(bg.id)}
                      >
                        <img
                          src={`/api/backgrounds/${bg.id}`}
                          alt=""
                          loading="lazy"
                          className="w-full aspect-video object-cover bg-black"
                        />
                        <div className="absolute bottom-0 left-0 right-0 px-1.5 py-0.5 bg-black/60 text-[9px] text-warm-300 truncate">
                          {bg.source === "ai" ? "AI" : "Файл"}
                          {bg.referenceImagePath ? " · ref" : ""}
                          {bg.seed != null ? ` · ${bg.seed}` : ""}
                        </div>
                        <button
                          type="button"
                          className="absolute top-1 right-1 p-1 rounded bg-black/50 text-warm-400 hover:text-red-400"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteBg(bg.id);
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-warm-500">
                  {bgSearchDebounced || bgSourceFilter !== "all"
                    ? "Ничего не найдено — измените фильтр или поиск"
                    : "Нет обложек — сгенерируйте AI или загрузите файл"}
                </p>
              )}

              {hasMoreBackgrounds && (
                <button
                  type="button"
                  className="btn-secondary text-xs w-full"
                  onClick={() => setLoadedPages((p) => p + 1)}
                  disabled={loadingBackgrounds}
                >
                  Показать ещё ({bgTotal - backgrounds.length} осталось)
                </button>
              )}

            </div>

            {failedBackgrounds.length > 0 && (
              <div className="space-y-1">
                {!showFailedErrors ? (
                  <button
                    type="button"
                    className="text-xs text-warm-500 hover:text-warm-300 underline"
                    onClick={() => setShowFailedErrors(true)}
                  >
                    Прошлые ошибки генерации ({failedBackgrounds.length}) — показать
                  </button>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-warm-500">Прошлые неудачные генерации</p>
                      <button
                        type="button"
                        className="text-xs text-warm-500 hover:text-warm-300"
                        onClick={() => setShowFailedErrors(false)}
                      >
                        Скрыть
                      </button>
                    </div>
                    {failedBackgrounds.map((b) => (
                      <div
                        key={b.id}
                        className="p-2 rounded border border-red-500/30 bg-red-500/5 flex gap-2 justify-between items-start"
                      >
                        <p className="text-xs text-red-400 whitespace-pre-wrap flex-1">
                          {b.errorMessage || "Ошибка генерации"}
                        </p>
                        <button
                          type="button"
                          className="text-xs text-warm-500 hover:text-warm-300 shrink-0"
                          onClick={() => deleteBg(b.id)}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <p className="label mb-2">Видео</p>
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div>
            <p className="text-xs text-warm-500 mb-1">Разрешение</p>
            <select
              className="input w-full text-xs"
              value={resolution}
              onChange={(e) => setResolution(e.target.value as ResolutionPreset)}
            >
              <option value="1080p">1080p</option>
              <option value="720p">720p</option>
            </select>
          </div>
          <div>
            <p className="text-xs text-warm-500 mb-1">FPS</p>
            <select
              className="input w-full text-xs"
              value={fps}
              onChange={(e) => setFps(Number(e.target.value) as FpsPreset)}
            >
              <option value={30}>30</option>
              <option value={24}>24</option>
            </select>
          </div>
          <div>
            <p className="text-xs text-warm-500 mb-1">Качество</p>
            <select
              className="input w-full text-xs"
              value={quality}
              onChange={(e) => setQuality(e.target.value as VideoQuality)}
            >
              <option value="high">{qualityLabel("high")}</option>
              <option value="standard">{qualityLabel("standard")}</option>
              <option value="fast">{qualityLabel("fast")}</option>
            </select>
          </div>
        </div>

        <p className="text-xs text-warm-500 mb-1">Визуальный эффект</p>
        <select
          className="input w-full text-xs mb-1"
          value={videoEffect}
          onChange={(e) => setVideoEffect(e.target.value as VideoEffect)}
        >
          {VIDEO_EFFECTS.map((effect) => (
            <option key={effect.id} value={effect.id}>
              {effect.label}
            </option>
          ))}
        </select>
        {selectedEffect && (
          <p className="text-xs text-warm-500 mb-1">{selectedEffect.description}</p>
        )}
        <p className="text-[10px] text-warm-600 mb-4">
          Эффект только на фоне — с движением (зерно, мерцание). Waveform без обработки
        </p>

        <p className="label mb-2">Аудио</p>
        <select
          className="input w-full text-xs mb-5"
          value={audioBitrate}
          onChange={(e) => setAudioBitrate(Number(e.target.value) as AudioBitrate)}
        >
          <option value={128}>AAC 128 kbps</option>
          <option value={192}>AAC 192 kbps</option>
          <option value={320}>AAC 320 kbps</option>
        </select>

        {createBlockReason && (
          <p className="text-xs text-amber-400 mb-3">{createBlockReason}</p>
        )}
        {createError && (
          <p className="text-xs text-red-400 mb-3 whitespace-pre-wrap">{createError}</p>
        )}

        <div className="flex gap-2 justify-end">
          <button type="button" className="btn-secondary text-xs" onClick={onClose}>
            Отмена
          </button>
          <LoadingButton
            onClick={createJob}
            loading={creating}
            loadingText="Запуск..."
            className="text-xs"
            disabled={!canCreate}
          >
            Создать
          </LoadingButton>
        </div>
      </Card>
    </div>
  );
}
