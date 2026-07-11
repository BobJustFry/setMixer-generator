import {
  DEFAULT_VIDEO_EFFECT,
  parseVideoEffect,
  type VideoEffect,
} from "@/lib/video-effects";

export type VideoQuality = "high" | "standard" | "fast";
export type ResolutionPreset = "1080p" | "720p";
export type FpsPreset = 30 | 24;
export type AudioBitrate = 128 | 192 | 320;

export interface EncodeSettings {
  width: number;
  height: number;
  fps: FpsPreset;
  quality: VideoQuality;
  audioBitrateKbps: AudioBitrate;
  videoEffect: VideoEffect;
}

export const DEFAULT_ENCODE_SETTINGS: EncodeSettings = {
  width: 1920,
  height: 1080,
  fps: 30,
  quality: "standard",
  audioBitrateKbps: 192,
  videoEffect: DEFAULT_VIDEO_EFFECT,
};

export function resolutionToSize(res: ResolutionPreset): { width: number; height: number } {
  return res === "720p" ? { width: 1280, height: 720 } : { width: 1920, height: 1080 };
}

export function buildEncodeSettings(input: {
  resolution: ResolutionPreset;
  fps: FpsPreset;
  quality: VideoQuality;
  audioBitrateKbps: AudioBitrate;
  videoEffect: VideoEffect;
}): EncodeSettings {
  const { width, height } = resolutionToSize(input.resolution);
  return {
    width,
    height,
    fps: input.fps,
    quality: input.quality,
    audioBitrateKbps: input.audioBitrateKbps,
    videoEffect: input.videoEffect,
  };
}

export function parseEncodeSettings(raw: unknown): EncodeSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_ENCODE_SETTINGS;
  const o = raw as Partial<EncodeSettings>;
  return {
    width: o.width === 1280 ? 1280 : 1920,
    height: o.height === 720 ? 720 : 1080,
    fps: o.fps === 24 ? 24 : 30,
    quality: o.quality === "high" || o.quality === "fast" ? o.quality : "standard",
    audioBitrateKbps:
      o.audioBitrateKbps === 128 || o.audioBitrateKbps === 320
        ? o.audioBitrateKbps
        : 192,
    videoEffect: parseVideoEffect(o.videoEffect),
  };
}

export function qualityLabel(q: VideoQuality): string {
  const map: Record<VideoQuality, string> = {
    high: "Высокое",
    standard: "Стандарт",
    fast: "Быстрый рендер",
  };
  return map[q];
}
