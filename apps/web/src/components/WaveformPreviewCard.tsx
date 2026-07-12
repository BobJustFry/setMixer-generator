"use client";

import { useEffect, useState } from "react";

interface WaveformPreviewCardProps {
  mixId: string;
  waveformPath: string | null;
  updatedAt: string;
  durationSec: number | null;
  isBuilding: boolean;
  stageDetail?: string | null;
  stageProgress?: number;
  /** 0–100: grey timeline fill while analyze/render is in progress */
  fillProgress?: number | null;
}

export function WaveformPreviewCard({
  mixId,
  waveformPath,
  updatedAt,
  durationSec,
  isBuilding,
  stageDetail,
  stageProgress = 0,
  fillProgress,
}: WaveformPreviewCardProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const url = waveformPath
    ? `/api/mixes/${mixId}/waveform?v=${encodeURIComponent(updatedAt)}`
    : null;

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [url]);

  const showLoading = isBuilding || (!loaded && !failed);
  const showError = failed && !loaded && !isBuilding;
  const showWaveform = loaded && !showLoading;
  const fillPct =
    fillProgress != null ? Math.min(Math.max(fillProgress, 0), 100) : null;

  return (
    <div className="rounded-lg overflow-hidden bg-[#0e0e14] border border-surface-border min-h-[88px]">
      {showLoading && (
        <WaveformLoadingPlaceholder
          detail={stageDetail}
          progress={isBuilding ? stageProgress : undefined}
        />
      )}
      {url && showWaveform && (
        <div className="relative">
          <img src={url} alt="" className="w-full h-auto block" />
          {fillPct != null && fillPct > 0 && (
            <>
              <div
                className="absolute inset-y-0 left-0 bg-white/12 pointer-events-none transition-[width] duration-500 ease-out"
                style={{ width: `${fillPct}%` }}
              />
              <div
                className="absolute inset-y-0 bg-black/30 pointer-events-none transition-[left] duration-500 ease-out"
                style={{ left: `${fillPct}%`, right: 0 }}
              />
              <div
                className="absolute inset-y-0 w-px bg-white/25 pointer-events-none transition-[left] duration-500 ease-out"
                style={{ left: `${fillPct}%` }}
              />
            </>
          )}
        </div>
      )}
      {url && !showWaveform && (
        <img
          src={url}
          alt=""
          className="hidden"
          onLoad={() => {
            setLoaded(true);
            setFailed(false);
          }}
          onError={() => setFailed(true)}
        />
      )}
      {showError && (
        <p className="text-xs text-warm-500 text-center py-8 px-3">
          Waveform недоступен — создайте видео заново
        </p>
      )}
    </div>
  );
}

function WaveformLoadingPlaceholder({
  detail,
  progress,
}: {
  detail?: string | null;
  progress?: number;
}) {
  const barHeights = [14, 28, 20, 36, 24, 32, 18, 26, 22, 30, 16, 34];

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8 px-4">
      <div className="flex items-end justify-center gap-[3px] h-9" aria-hidden>
        {barHeights.map((h, i) => (
          <span
            key={i}
            className="w-1 rounded-sm origin-bottom animate-[waveform-bar_1s_ease-in-out_infinite]"
            style={{
              height: h,
              backgroundColor: i % 3 === 0 ? "#2266ff" : i % 3 === 1 ? "#58ff30" : "#ffffff",
              opacity: 0.85,
              animationDelay: `${i * 0.07}s`,
            }}
          />
        ))}
      </div>
      <p className="text-xs text-warm-400 text-center">
        {detail?.trim() || "Построение waveform…"}
      </p>
      {progress != null && progress > 0 && (
        <div className="w-full max-w-sm h-1 bg-surface-overlay rounded-full overflow-hidden">
          <div
            className="h-full bg-accent/70 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
