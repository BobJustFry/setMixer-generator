"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Play, Save } from "lucide-react";
import { PageHeader, Card } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDuration } from "@/lib/utils";

interface Segment {
  id: string;
  index: number;
  startSec: number;
  endSec: number;
  confidence: number;
  label: string | null;
  thumbPrompt: string | null;
  source: string;
}

interface Job {
  id: string;
  title: string | null;
  status: string;
  progress: number;
  stylePrompt: string | null;
  template: string;
  errorMessage: string | null;
  mix: {
    filename: string;
    durationSec: number | null;
    filepath: string;
  };
  segments: Segment[];
  generatedVideo: {
    id: string;
    outputPath: string;
    durationSec: number | null;
  } | null;
  youtubeUpload: { id: string; uploadStatus: string } | null;
}

export default function JobDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [job, setJob] = useState<Job | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [saving, setSaving] = useState(false);
  const [rendering, setRendering] = useState(false);

  const loadJob = useCallback(async () => {
    const res = await fetch(`/api/jobs/${id}`);
    if (res.ok) {
      const data = await res.json();
      setJob(data);
      setSegments(data.segments);
    }
  }, [id]);

  useEffect(() => {
    loadJob();
    const interval = setInterval(loadJob, 4000);
    return () => clearInterval(interval);
  }, [loadJob]);

  async function saveSegments() {
    setSaving(true);
    await fetch(`/api/jobs/${id}/segments`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        segments: segments.map((s, i) => ({
          index: i,
          startSec: s.startSec,
          endSec: s.endSec,
          label: s.label,
          thumbPrompt: s.thumbPrompt,
        })),
      }),
    });
    await loadJob();
    setSaving(false);
  }

  async function startRender() {
    setRendering(true);
    await saveSegments();
    await fetch(`/api/jobs/${id}/segments`, { method: "POST" });
    await loadJob();
    setRendering(false);
  }

  function updateSegment(index: number, field: keyof Segment, value: string | number) {
    setSegments((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  }

  if (!job) {
    return <p className="text-warm-500">Загрузка...</p>;
  }

  const canEdit = ["ready_for_review", "analyzing", "failed"].includes(job.status);
  const canRender = segments.length > 0 && ["ready_for_review", "failed"].includes(job.status);

  return (
    <div>
      <div className="mb-4">
        <Link href="/jobs" className="btn-ghost text-xs">
          <ArrowLeft className="w-3 h-3" />
          Назад к задачам
        </Link>
      </div>

      <PageHeader
        title={job.title || job.mix.filename}
        description={job.mix.filename}
      >
        <StatusBadge status={job.status} />
      </PageHeader>

      {job.errorMessage && (
        <Card className="p-4 mb-4 border-red-500/30">
          <p className="text-sm text-red-400">{job.errorMessage}</p>
        </Card>
      )}

      {job.status === "rendering" && (
        <Card className="p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-warm-300">Рендер видео...</p>
            <span className="text-sm text-accent">{job.progress}%</span>
          </div>
          <div className="h-1.5 bg-surface-overlay rounded-full overflow-hidden">
            <div
              className="h-full bg-accent/80 rounded-full transition-all duration-500"
              style={{ width: `${job.progress}%` }}
            />
          </div>
        </Card>
      )}

      {job.generatedVideo && (
        <Card className="p-4 mb-4">
          <p className="text-sm text-green-400 font-medium mb-1">Видео готово</p>
          <p className="text-xs text-warm-500">
            {formatDuration(job.generatedVideo.durationSec)}
            {" · "}
            {job.generatedVideo.outputPath}
          </p>
          <div className="flex gap-2 mt-3">
            <Link href="/videos" className="btn-secondary text-xs">
              К списку видео
            </Link>
            {!job.youtubeUpload && (
              <Link href={`/schedule?job=${job.id}`} className="btn-primary text-xs">
                Запланировать на YouTube
              </Link>
            )}
          </div>
        </Card>
      )}

      <Card className="mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-warm-300">
            Сегменты ({segments.length})
          </h2>
          <div className="flex gap-2">
            {canEdit && (
              <button onClick={saveSegments} disabled={saving} className="btn-secondary text-xs">
                <Save className="w-3 h-3" />
                {saving ? "..." : "Сохранить"}
              </button>
            )}
            {canRender && (
              <button onClick={startRender} disabled={rendering} className="btn-primary text-xs">
                <Play className="w-3 h-3" />
                {rendering ? "..." : "Запустить рендер"}
              </button>
            )}
          </div>
        </div>

        {segments.length === 0 ? (
          <p className="text-sm text-warm-500">
            {job.status === "analyzing"
              ? "Анализ аудио в процессе..."
              : "Сегменты не найдены"}
          </p>
        ) : (
          <div className="space-y-3">
            {segments.map((seg, i) => (
              <div
                key={seg.id || i}
                className="p-3 rounded-lg bg-surface-overlay border border-surface-border"
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs text-accent font-mono w-6">#{i + 1}</span>
                  <span className="text-xs text-warm-500 font-mono">
                    {formatDuration(seg.startSec)} — {formatDuration(seg.endSec)}
                  </span>
                  {seg.confidence < 1 && (
                    <span className="text-xs text-warm-600">
                      {(seg.confidence * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">Название</label>
                    <input
                      className="input text-xs"
                      value={seg.label || ""}
                      onChange={(e) => updateSegment(i, "label", e.target.value)}
                      disabled={!canEdit}
                    />
                  </div>
                  <div>
                    <label className="label">Промпт для AI</label>
                    <input
                      className="input text-xs"
                      value={seg.thumbPrompt || job.stylePrompt || ""}
                      onChange={(e) => updateSegment(i, "thumbPrompt", e.target.value)}
                      disabled={!canEdit}
                    />
                  </div>
                </div>
                {canEdit && (
                  <div className="flex gap-2 mt-2">
                    <input
                      type="number"
                      className="input text-xs w-24"
                      value={Math.round(seg.startSec)}
                      onChange={(e) =>
                        updateSegment(i, "startSec", parseFloat(e.target.value) || 0)
                      }
                      step={1}
                      title="Начало (сек)"
                    />
                    <input
                      type="number"
                      className="input text-xs w-24"
                      value={Math.round(seg.endSec)}
                      onChange={(e) =>
                        updateSegment(i, "endSec", parseFloat(e.target.value) || 0)
                      }
                      step={1}
                      title="Конец (сек)"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
