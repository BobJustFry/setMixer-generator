"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { LoadingButton } from "@/components/LoadingButton";
import { useTasks } from "@/components/TaskProvider";

interface Upload {
  id: string;
  title: string;
  description: string;
  tags: string[];
  privacyStatus: string;
  publishAt: string | null;
  uploadStatus: string;
  youtubeVideoId: string | null;
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
  });
  const [submitting, setSubmitting] = useState(false);
  const [youtubeChannel, setYoutubeChannel] = useState<string | null>(null);
  const { refresh: refreshTasks } = useTasks();

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
    fetch("/api/youtube/uploads")
      .then((r) => r.json())
      .then(setUploads);
    fetch("/api/videos")
      .then((r) => r.json())
      .then((videos) => {
        const readyJobs = videos
          .filter((v: { videoJob: { youtubeUpload: unknown } }) => !v.videoJob.youtubeUpload)
          .map((v: { videoJob: Job }) => v.videoJob);
        setJobs(readyJobs);
        if (preselectedJob) {
          const job = readyJobs.find((j: Job) => j.id === preselectedJob);
          if (job) {
            setForm((f) => ({
              ...f,
              videoJobId: job.id,
              title: job.title || job.mix.filename,
              description: `DJ Mix — ${job.title || job.mix.filename}\n\n#djmix #music #setmixer`,
            }));
          }
        }
      });
  }, [preselectedJob]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const res = await fetch("/api/youtube/uploads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        publishAt: form.publishAt || null,
      }),
    });

    if (res.ok) {
      setShowForm(false);
      await refreshTasks();
      const updated = await fetch("/api/youtube/uploads").then((r) => r.json());
      setUploads(updated);
    }
    setSubmitting(false);
  }

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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Видимость</label>
                <select
                  className="input"
                  value={form.privacyStatus}
                  onChange={(e) => setForm({ ...form, privacyStatus: e.target.value })}
                >
                  <option value="private">Приватное (с датой публикации)</option>
                  <option value="unlisted">Ссылка</option>
                  <option value="public">Публичное</option>
                </select>
              </div>
              <div>
                <label className="label">Дата публикации</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={form.publishAt}
                  onChange={(e) => setForm({ ...form, publishAt: e.target.value })}
                />
              </div>
            </div>
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
            <Card key={u.id} className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-warm-100">{u.title}</p>
                  <p className="text-xs text-warm-500 mt-0.5">
                    {u.publishAt
                      ? new Date(u.publishAt).toLocaleString("ru-RU")
                      : "Без даты"}
                    {u.youtubeVideoId ? ` · ${u.youtubeVideoId}` : ""}
                  </p>
                </div>
                <StatusBadge status={u.uploadStatus} />
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
