"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Play, Loader2, Trash2 } from "lucide-react";
import { LoadingButton } from "@/components/LoadingButton";
import { useTasks } from "@/components/TaskProvider";
import { PageHeader, Card } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { JobProgressSpinner } from "@/components/JobProgressDisplay";
import { formatDuration, templateLabel } from "@/lib/utils";
import { videoEffectLabel } from "@/lib/video-effects";
import { parseEncodeSettings } from "@/lib/encode-settings";

interface Job {
  id: string;
  title: string | null;
  status: string;
  progress: number;
  stage: string | null;
  stageProgress: number;
  stageDetail: string | null;
  template: string;
  encodeSettings?: unknown;
  errorMessage: string | null;
  mix: {
    id: string;
    filename: string;
    durationSec: number | null;
    waveformPath: string | null;
  };
  generatedVideo: {
    id: string;
    outputPath: string;
    durationSec: number | null;
  } | null;
  youtubeUpload: { id: string; uploadStatus: string; youtubeVideoId: string | null } | null;
}

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [job, setJob] = useState<Job | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deletingJob, setDeletingJob] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { refresh: refreshTasks, active } = useTasks();

  const loadJob = useCallback(async () => {
    const res = await fetch(`/api/jobs/${id}`);
    if (res.ok) {
      const data = await res.json();
      setJob(data);
      setLoadError(null);
    } else {
      setLoadError(
        (prev) =>
          prev ?? (res.status === 404 ? "Задача не найдена" : "Не удалось загрузить задачу")
      );
    }
  }, [id]);

  useEffect(() => {
    loadJob();
    const interval = setInterval(loadJob, 4000);
    return () => clearInterval(interval);
  }, [loadJob]);

  async function startRender() {
    setRendering(true);
    await fetch(`/api/jobs/${id}/render`, { method: "POST" });
    await refreshTasks();
    await loadJob();
    setRendering(false);
  }

  if (!job) {
    const pendingTask = active.find(
      (t) => t.videoJobId === id && ["pending", "running"].includes(t.status)
    );

    return (
      <div>
        <div className="mb-4">
          <Link href="/jobs" className="btn-ghost text-xs">
            <ArrowLeft className="w-3 h-3" />
            Назад к задачам
          </Link>
        </div>
        {loadError ? (
          <Card className="p-4 border-red-500/30">
            <p className="text-sm text-red-400">{loadError}</p>
          </Card>
        ) : (
          <Card className="p-6">
            <div className="flex items-center gap-3 text-warm-300">
              <Loader2 className="w-5 h-5 animate-spin text-accent shrink-0" />
              <p className="text-sm font-medium">Загрузка задачи...</p>
            </div>
            {pendingTask && (
              <div className="mt-4">
                <JobProgressSpinner
                  state={{
                    progress: pendingTask.progress,
                    stage: pendingTask.stage,
                    stageProgress: pendingTask.stageProgress,
                    stageDetail: pendingTask.stageDetail,
                    status: pendingTask.status,
                  }}
                />
              </div>
            )}
          </Card>
        )}
      </div>
    );
  }

  const activeTask = active.find(
    (t) =>
      t.videoJobId === job.id &&
      ["pending", "running"].includes(t.status) &&
      (t.type === "analyze" || t.type === "render")
  );
  const progressState = {
    progress: activeTask?.progress ?? job.progress,
    stage: activeTask?.stage ?? job.stage,
    stageProgress: activeTask?.stageProgress ?? job.stageProgress,
    stageDetail: activeTask?.stageDetail ?? job.stageDetail,
    status: activeTask?.status ?? job.status,
  };
  const isWorking = job.status === "analyzing" || job.status === "rendering";
  const canRerender = job.mix.waveformPath && !job.generatedVideo && !isWorking;
  const canDeleteJob = !isWorking && job.status !== "pending" && !job.youtubeUpload?.youtubeVideoId;
  const encode = parseEncodeSettings(job.encodeSettings);
  const effectLabel = videoEffectLabel(encode.videoEffect);

  async function deleteVideo() {
    if (!job?.generatedVideo || !confirm("Удалить видеофайл?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/videos/${job.generatedVideo.id}`, { method: "DELETE" });
      if (res.ok) await loadJob();
    } finally {
      setDeleting(false);
    }
  }

  async function deleteJob() {
    if (!job || !confirm(`Удалить задачу «${job.title || job.mix.filename}»?`)) return;
    setDeletingJob(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Не удалось удалить");
        return;
      }
      router.push("/jobs");
    } finally {
      setDeletingJob(false);
    }
  }

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
        description={`${job.mix.filename} · ${templateLabel(job.template)} · ${effectLabel}`}
      >
        <div className="flex items-center gap-2">
          <StatusBadge status={job.status} />
          {canDeleteJob && (
            <LoadingButton
              onClick={deleteJob}
              loading={deletingJob}
              loadingText="..."
              variant="secondary"
              className="text-xs text-red-400 hover:text-red-300"
            >
              <Trash2 className="w-3 h-3" />
              Удалить задачу
            </LoadingButton>
          )}
        </div>
      </PageHeader>

      {job.errorMessage && (
        <Card className="p-4 mb-4 border-red-500/30">
          <p className="text-sm text-red-400">{job.errorMessage}</p>
        </Card>
      )}

      {isWorking && (
        <Card className="p-4 mb-4 border-accent/20">
          <JobProgressSpinner state={progressState} />
        </Card>
      )}

      {job.mix.waveformPath && (
        <Card className="p-4 mb-4">
          <p className="text-xs text-warm-500 mb-2">Waveform (Denon)</p>
          <div className="rounded-lg overflow-hidden bg-[#0e0e14] border border-surface-border">
            <img
              src={`/api/mixes/${job.mix.id}/waveform`}
              alt="Waveform"
              className="w-full h-auto block"
            />
          </div>
          {job.mix.durationSec && (
            <p className="text-xs text-warm-500 mt-2">
              Длительность: {formatDuration(job.mix.durationSec)}
            </p>
          )}
        </Card>
      )}

      {job.generatedVideo && (
        <Card className="p-4 mb-4">
          <p className="text-sm text-green-400 font-medium mb-3">Видео готово</p>
          <div className="rounded-lg overflow-hidden bg-black border border-surface-border mb-3">
            <video
              controls
              preload="metadata"
              className="w-full max-h-[480px]"
              src={`/api/jobs/${job.id}/video`}
            />
          </div>
          <p className="text-xs text-warm-500">
            {formatDuration(job.generatedVideo.durationSec)}
          </p>
          <div className="flex gap-2 mt-3 flex-wrap">
            <Link href="/videos" className="btn-secondary text-xs">
              К списку видео
            </Link>
            {!job.youtubeUpload && (
              <Link href={`/schedule?job=${job.id}`} className="btn-primary text-xs">
                Запланировать на YouTube
              </Link>
            )}
            <LoadingButton
              onClick={deleteVideo}
              loading={deleting}
              loadingText="..."
              variant="secondary"
              className="text-xs text-red-400 hover:text-red-300"
            >
              <Trash2 className="w-3 h-3" />
              Удалить видео
            </LoadingButton>
          </div>
        </Card>
      )}

      {canRerender && (
        <Card className="p-4">
          <LoadingButton onClick={startRender} loading={rendering} loadingText="Запуск..." className="text-xs">
            <Play className="w-3 h-3" />
            Повторить рендер
          </LoadingButton>
        </Card>
      )}
    </div>
  );
}
