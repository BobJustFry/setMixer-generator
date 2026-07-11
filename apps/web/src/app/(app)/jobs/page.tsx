"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Trash2 } from "lucide-react";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";
import { useTasks } from "@/components/TaskProvider";

interface Job {
  id: string;
  title: string | null;
  status: string;
  progress: number;
  createdAt: string;
  mix: { filename: string };
  _count: { segments: number };
  generatedVideo: { id: string } | null;
  youtubeUpload: { uploadStatus: string; youtubeVideoId: string | null } | null;
}

const ACTIVE_STATUSES = ["pending", "analyzing", "rendering"];

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const { active } = useTasks();

  async function load() {
    const res = await fetch("/api/jobs");
    if (res.ok) setJobs(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  function jobProgress(job: Job): number | null {
    if (job.status === "rendering" || job.status === "analyzing") {
      const task = active.find(
        (t) => t.videoJobId === job.id && ["pending", "running"].includes(t.status)
      );
      return Math.max(job.progress, task?.progress ?? 0);
    }
    return null;
  }

  function canDelete(job: Job): boolean {
    if (ACTIVE_STATUSES.includes(job.status)) return false;
    if (job.youtubeUpload?.youtubeVideoId) return false;
    return true;
  }

  const finishedJobs = jobs.filter(canDelete);

  async function deleteJob(job: Job, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!canDelete(job)) return;
    if (!confirm(`Удалить задачу «${job.title || job.mix.filename}»?`)) return;

    setDeletingId(job.id);
    try {
      const res = await fetch(`/api/jobs/${job.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Не удалось удалить");
        return;
      }
      await load();
    } finally {
      setDeletingId(null);
    }
  }

  async function clearFinished() {
    if (finishedJobs.length === 0) return;
    if (!confirm(`Удалить ${finishedJobs.length} завершённых задач? Видеофайлы тоже будут удалены.`)) {
      return;
    }

    setClearing(true);
    try {
      const res = await fetch("/api/jobs/clear", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Не удалось очистить");
        return;
      }
      await load();
    } finally {
      setClearing(false);
    }
  }

  return (
    <div>
      <PageHeader title="Задачи" description="Генерация видео из миксов">
        {finishedJobs.length > 0 && (
          <button
            type="button"
            onClick={clearFinished}
            disabled={clearing}
            className="btn-secondary text-xs text-warm-400 hover:text-warm-200 disabled:opacity-50"
          >
            {clearing ? "Удаление..." : `Очистить завершённые (${finishedJobs.length})`}
          </button>
        )}
      </PageHeader>

      {loading ? (
        <Card className="p-6 flex items-center gap-3 text-warm-400">
          <Loader2 className="w-4 h-4 animate-spin text-accent" />
          <span className="text-sm">Загрузка списка...</span>
        </Card>
      ) : !jobs.length ? (
        <EmptyState
          title="Задач нет"
          description="Создайте задачу из раздела «Миксы»"
          action={
            <Link href="/mixes" className="btn-primary">
              Перейти к миксам
            </Link>
          }
        />
      ) : (
        <div className="space-y-2">
          {jobs.map((job) => {
            const progress = jobProgress(job);
            const deletable = canDelete(job);
            return (
              <Link key={job.id} href={`/jobs/${job.id}`}>
                <Card className="p-4 hover:border-accent/30 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-warm-100 truncate">
                        {job.title || job.mix.filename}
                      </p>
                      <p className="text-xs text-warm-500 mt-0.5 truncate">
                        {job.mix.filename}
                      </p>
                      {progress !== null && (
                        <div className="mt-2 h-1 bg-surface-overlay rounded-full overflow-hidden max-w-xs">
                          <div
                            className="h-full bg-accent/80 rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {progress !== null && (
                        <span className="text-xs text-accent font-mono">{progress}%</span>
                      )}
                      <StatusBadge status={job.status} />
                      {deletable && (
                        <button
                          type="button"
                          onClick={(e) => deleteJob(job, e)}
                          disabled={deletingId === job.id}
                          className="p-1.5 rounded hover:bg-red-500/20 text-warm-500 hover:text-red-400 transition-colors disabled:opacity-50"
                          title="Удалить задачу"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
