"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { LoadingButton } from "@/components/LoadingButton";
import { useTasks } from "@/components/TaskProvider";
import {
  datetimeLocalMinValue,
  datetimeLocalToIso,
  validateYouTubePublishAt,
} from "@/lib/youtube-schedule";
import { canScheduleYoutubeUpload, canRetryYoutubeUpload, type YoutubeUploadRef } from "@/lib/youtube-upload-status";

interface YoutubeUpload extends YoutubeUploadRef {
  title: string;
  description: string;
  tags: string[];
  privacyStatus: string;
  playlistId?: string | null;
  errorMessage?: string | null;
}

interface Playlist {
  id: string;
  title: string;
  itemCount: number;
}

interface Upload {
  id: string;
  title: string;
  description: string;
  tags: string[];
  privacyStatus: string;
  publishAt: string | null;
  uploadStatus: string;
  youtubeVideoId: string | null;
  playlistId?: string | null;
  playlistTitle?: string | null;
  errorMessage?: string | null;
  videoJob: {
    id: string;
    title: string | null;
    mix: { filename: string };
  };
}

interface Job {
  id: string;
  title: string | null;
  mix: { filename: string };
  youtubeUpload?: YoutubeUpload | null;
}

interface VideoEntry {
  videoJob: Job;
}

function ScheduleContent() {
  const searchParams = useSearchParams();
  const preselectedJob = searchParams.get("job");

  const [uploads, setUploads] = useState<Upload[]>([]);
  const [showForm, setShowForm] = useState(!!preselectedJob);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [form, setForm] = useState({
    videoJobId: preselectedJob || "",
    title: "",
    description: "",
    tags: "",
    privacyStatus: "private",
    publishAt: "",
    playlistId: "",
  });
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [playlistsError, setPlaylistsError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [youtubeChannel, setYoutubeChannel] = useState<string | null>(null);
  const publishAtMin = datetimeLocalMinValue();
  const { refresh: refreshTasks, active } = useTasks();

  function hasActiveYoutubeTask(jobId: string) {
    return active.some(
      (t) =>
        t.type === "youtube_upload" &&
        t.videoJobId === jobId &&
        ["pending", "running"].includes(t.status)
    );
  }

  function fillFormFromJob(job: Job) {
    const upload = job.youtubeUpload;
    setForm({
      videoJobId: job.id,
      title: upload?.title || job.title || job.mix.filename,
      description:
        upload?.description ||
        `DJ Mix — ${job.title || job.mix.filename}\n\n#djmix #music #setmixer`,
      tags: upload?.tags?.length ? upload.tags.join(", ") : "",
      privacyStatus: upload?.privacyStatus || "private",
      publishAt: "",
      playlistId: upload?.playlistId || "",
    });
  }

  async function loadScheduleData() {
    const [uploadsRes, videosRes] = await Promise.all([
      fetch("/api/youtube/uploads"),
      fetch("/api/videos"),
    ]);
    const uploadsData = uploadsRes.ok ? await uploadsRes.json() : [];
    const videos: VideoEntry[] = videosRes.ok ? await videosRes.json() : [];
    setUploads(uploadsData);

    const readyJobs = videos
      .filter((v) =>
        canScheduleYoutubeUpload(v.videoJob.youtubeUpload ?? null, hasActiveYoutubeTask(v.videoJob.id))
      )
      .map((v) => v.videoJob);
    setJobs(readyJobs);
  }

  useEffect(() => {
    if (!preselectedJob) return;

    let cancelled = false;
    (async () => {
      const res = await fetch("/api/videos");
      if (!res.ok || cancelled) return;
      const videos: VideoEntry[] = await res.json();
      const entry = videos.find((v) => v.videoJob.id === preselectedJob);
      if (
        entry &&
        canScheduleYoutubeUpload(
          entry.videoJob.youtubeUpload ?? null,
          hasActiveYoutubeTask(entry.videoJob.id)
        )
      ) {
        fillFormFromJob(entry.videoJob);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [preselectedJob]);

  useEffect(() => {
    loadScheduleData();
    const interval = setInterval(loadScheduleData, 5000);
    return () => clearInterval(interval);
  }, [active]);

  useEffect(() => {
    fetch("/api/youtube/status")
      .then((r) => r.json())
      .then((data) => {
        if (data.connected && data.channelTitle) {
          setYoutubeChannel(data.channelTitle);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!showForm) return;

    setPlaylistsLoading(true);
    setPlaylistsError(null);
    fetch("/api/youtube/playlists")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setPlaylists(data);
        } else {
          setPlaylists([]);
          setPlaylistsError(data.error || "Не удалось загрузить плейлисты");
        }
      })
      .catch(() => {
        setPlaylists([]);
        setPlaylistsError("Не удалось загрузить плейлисты");
      })
      .finally(() => setPlaylistsLoading(false));
  }, [showForm]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const publishAtIso = form.publishAt ? datetimeLocalToIso(form.publishAt) : null;
    const publishAtDate = publishAtIso ? new Date(publishAtIso) : null;
    const localError = validateYouTubePublishAt(publishAtDate);
    if (localError) {
      setSubmitError(localError);
      return;
    }

    setSubmitting(true);

    const selectedPlaylist = playlists.find((p) => p.id === form.playlistId);

    const res = await fetch("/api/youtube/uploads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        privacyStatus: publishAtIso ? "private" : form.privacyStatus,
        publishAt: publishAtIso,
        playlistId: form.playlistId || null,
        playlistTitle: selectedPlaylist?.title || null,
      }),
    });

    if (res.ok) {
      setShowForm(false);
      await refreshTasks();
      await loadScheduleData();
    } else {
      const data = await res.json().catch(() => ({}));
      setSubmitError(data.error || "Не удалось запланировать публикацию");
    }
    setSubmitting(false);
  }

  function openRetryForm(upload: Upload) {
    setForm({
      videoJobId: upload.videoJob.id,
      title: upload.title,
      description: upload.description,
      tags: upload.tags.join(", "),
      privacyStatus: upload.privacyStatus,
      publishAt: "",
      playlistId: upload.playlistId || "",
    });
    setSubmitError(null);
    setShowForm(true);
  }

  useEffect(() => {
    fetch("/api/youtube/status")
      .then((r) => r.json())
      .then((data) => {
        if (data.connected && data.channelTitle) {
          setYoutubeChannel(data.channelTitle);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div>
      <PageHeader
        title="Расписание YouTube"
        description="Отложенная публикация видео"
      >
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          {showForm ? "Отмена" : "Новая публикация"}
        </button>
      </PageHeader>

      {showForm && (
        <Card className="mb-6">
          {youtubeChannel && (
            <p className="text-xs text-warm-500 mb-4 pb-3 border-b border-surface-border">
              Канал для загрузки:{" "}
              <span className="text-warm-300">{youtubeChannel}</span>
              {" · "}
              <a href="/settings" className="text-accent hover:underline">
                сменить в настройках
              </a>
            </p>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Видео</label>
              <select
                className="input"
                value={form.videoJobId}
                onChange={(e) => setForm({ ...form, videoJobId: e.target.value })}
                required
              >
                <option value="">Выберите видео</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title || j.mix.filename}
                    {j.youtubeUpload?.uploadStatus === "failed" ? " (повтор)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Заголовок</label>
              <input
                className="input"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Описание</label>
              <textarea
                className="input min-h-[100px]"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Теги (через запятую)</label>
              <input
                className="input"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="dj mix, deep house, setmixer"
              />
            </div>
            <div>
              <label className="label">Плейлист</label>
              <select
                className="input"
                value={form.playlistId}
                onChange={(e) => setForm({ ...form, playlistId: e.target.value })}
                disabled={playlistsLoading}
              >
                <option value="">Не добавлять в плейлист</option>
                {playlists.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.itemCount})
                  </option>
                ))}
              </select>
              {playlistsLoading && (
                <p className="text-xs text-warm-500 mt-1">Загрузка плейлистов…</p>
              )}
              {playlistsError && (
                <p className="text-xs text-amber-400 mt-1">{playlistsError}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Видимость</label>
                <select
                  className="input"
                  value={form.publishAt ? "private" : form.privacyStatus}
                  disabled={Boolean(form.publishAt)}
                  onChange={(e) => setForm({ ...form, privacyStatus: e.target.value })}
                >
                  <option value="private">Приватное (с датой публикации)</option>
                  <option value="unlisted">Ссылка (сразу)</option>
                  <option value="public">Публичное (сразу)</option>
                </select>
                {form.publishAt && (
                  <p className="text-xs text-warm-500 mt-1">
                    При отложенной публикации YouTube требует «Приватное».
                  </p>
                )}
              </div>
              <div>
                <label className="label">Дата публикации</label>
                <input
                  type="datetime-local"
                  className="input"
                  min={publishAtMin}
                  value={form.publishAt}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      publishAt: e.target.value,
                      privacyStatus: e.target.value ? "private" : form.privacyStatus,
                    })
                  }
                />
                <p className="text-xs text-warm-500 mt-1">
                  Ваше локальное время · минимум +15 мин от сейчас. Оставьте пустым для немедленной
                  публикации.
                </p>
              </div>
            </div>
            {submitError && (
              <p className="text-sm text-red-400">{submitError}</p>
            )}
            <LoadingButton type="submit" loading={submitting} loadingText="Отправка...">
              Запланировать
            </LoadingButton>
          </form>
        </Card>
      )}

      {!uploads.length ? (
        <EmptyState title="Публикаций нет" />
      ) : (
        <div className="space-y-2">
          {uploads.map((u) => (
            <Card
              key={u.id}
              className={`p-4 ${u.uploadStatus === "failed" ? "border-red-500/30" : ""}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-warm-100">{u.title}</p>
                  <p className="text-xs text-warm-500 mt-0.5">
                    {u.videoJob.title || u.videoJob.mix.filename}
                    {" · "}
                    {u.publishAt
                      ? new Date(u.publishAt).toLocaleString("ru-RU")
                      : "Без даты"}
                    {u.playlistTitle ? ` · ${u.playlistTitle}` : ""}
                    {u.youtubeVideoId ? ` · ${u.youtubeVideoId}` : ""}
                  </p>
                  {u.errorMessage && (
                    <p className="text-xs text-red-400 mt-2 break-words">{u.errorMessage}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {canRetryYoutubeUpload(u, hasActiveYoutubeTask(u.videoJob.id)) && (
                    <button
                      type="button"
                      onClick={() => openRetryForm(u)}
                      className="btn-secondary text-xs"
                    >
                      Повторить
                    </button>
                  )}
                  <Link href={`/jobs/${u.videoJob.id}`} className="btn-ghost text-xs">
                    Видео
                  </Link>
                  <StatusBadge status={u.uploadStatus} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SchedulePage() {
  return (
    <Suspense fallback={<p className="text-warm-500">Загрузка...</p>}>
      <ScheduleContent />
    </Suspense>
  );
}
