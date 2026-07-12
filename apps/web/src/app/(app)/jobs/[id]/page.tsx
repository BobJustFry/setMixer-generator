"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Play, Loader2, Trash2, Upload } from "lucide-react";
import { LoadingButton } from "@/components/LoadingButton";
import { useTasks } from "@/components/TaskProvider";
import { PageHeader, Card } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { JobProgressDisplay, JobProgressSpinner } from "@/components/JobProgressDisplay";
import { WaveformPreviewCard } from "@/components/WaveformPreviewCard";
import { formatDuration, templateLabel } from "@/lib/utils";
import { videoEffectLabel } from "@/lib/video-effects";
import { parseEncodeSettings } from "@/lib/encode-settings";
import { canScheduleYoutubeUpload } from "@/lib/youtube-upload-status";

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
    updatedAt: string;
  };
  generatedVideo: {
    id: string;
    outputPath: string;
    durationSec: number | null;
  } | null;
  youtubeUpload: {
    id: string;
    uploadStatus: string;
    youtubeVideoId: string | null;
    errorMessage?: string | null;
  } | null;
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
  const activeYoutubeTask = active.find(
    (t) =>
      t.videoJobId === job.id &&
      t.type === "youtube_upload" &&
      ["pending", "running"].includes(t.status)
  );
  const isYoutubeUploading =
    Boolean(activeYoutubeTask) || job.youtubeUpload?.uploadStatus === "uploading";
  const youtubeProgressState = {
    progress: activeYoutubeTask?.progress ?? 0,
    status: activeYoutubeTask?.status ?? "running",
  };
  const progressState = {
    progress: activeTask?.progress ?? job.progress,
    stage: activeTask?.stage ?? job.stage,
    stageProgress: activeTask?.stageProgress ?? job.stageProgress,
    stageDetail: activeTask?.stageDetail ?? job.stageDetail,
    status: activeTask?.status ?? job.status,
  };
  const isWorking = job.status === "analyzing" || job.status === "rendering";
  const isBuildingWaveform =
    job.status === "analyzing" && progressState.stage === "waveform";
  const showWaveformSection =
    Boolean(job.mix.waveformPath) || isWorking || job.status === "analyzing";
  const canRerender = job.mix.waveformPath && !job.generatedVideo && !isWorking;
  const canSendToYoutube = canScheduleYoutubeUpload(
    job.youtubeUpload,
    Boolean(activeYoutubeTask)
  );
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

      {isYoutubeUploading && (
        <Card className="p-4 mb-4 border-red-500/25 bg-red-500/[0.04]">
          <div className="flex items-start gap-3">
            {youtubeProgressState.status === "pending" ? (
              <Loader2 className="w-5 h-5 animate-spin text-red-400 shrink-0 mt-0.5" />
            ) : (
              <Upload className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-warm-100 mb-3">Отправка на YouTube</p>
              <JobProgressDisplay state={youtubeProgressState} variant="youtube" />
              <p className="text-xs text-warm-600 mt-2">
                Большие видео загружаются долго — не закрывайте страницу.
              </p>
            </div>
          </div>
        </Card>
      )}

      {showWaveformSection && (
        <Card className="p-4 mb-4">
          <p className="text-xs text-warm-500 mb-2">Waveform (Denon)</p>
          <WaveformPreviewCard
            mixId={job.mix.id}
            waveformPath={job.mix.waveformPath}
            updatedAt={job.mix.updatedAt}
            durationSec={job.mix.durationSec}
            isBuilding={isBuildingWaveform}
            stageDetail={progressState.stageDetail}
            stageProgress={progressState.stageProgress}
            fillProgress={isWorking && job.mix.waveformPath ? progressState.progress : null}
          />
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
          {job.youtubeUpload?.uploadStatus === "failed" && (
            <div className="mb-3 p-3 rounded-lg border border-red-500/30 bg-red-500/5">
              <p className="text-sm text-red-400 font-medium">Ошибка отправки на YouTube</p>
              {job.youtubeUpload.errorMessage && (
                <p className="text-xs text-red-400/90 mt-1 break-words">
                  {job.youtubeUpload.errorMessage}
                </p>
              )}
            </div>
          )}
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
            {!job.youtubeUpload?.youtubeVideoId && (
              <>
                {job.youtubeUpload?.uploadStatus === "failed" ? (
                  <StatusBadge status="failed" />
                ) : job.youtubeUpload ? (
                  <StatusBadge status={job.youtubeUpload.uploadStatus} />
                ) : null}
              </>
            )}
            {canSendToYoutube && (
              <Link href={`/schedule?job=${job.id}`} className="btn-primary text-xs">
                {job.youtubeUpload?.uploadStatus === "failed"
                  ? "Повторить отправку на YouTube"
                  : "Запланировать на YouTube"}
              </Link>
            )}
            {!canSendToYoutube && job.youtubeUpload && !job.youtubeUpload.youtubeVideoId && (
              <Link href="/schedule" className="btn-secondary text-xs">
                Статус в расписании
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
