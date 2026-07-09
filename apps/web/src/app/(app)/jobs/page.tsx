"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";

interface Job {
  id: string;
  title: string | null;
  status: string;
  progress: number;
  createdAt: string;
  mix: { filename: string };
  _count: { segments: number };
  generatedVideo: { id: string } | null;
  youtubeUpload: { uploadStatus: string } | null;
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    fetch("/api/jobs")
      .then((r) => r.json())
      .then(setJobs);

    const interval = setInterval(() => {
      fetch("/api/jobs")
        .then((r) => r.json())
        .then(setJobs);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <PageHeader
        title="Задачи"
        description="Генерация видео из миксов"
      />

      {!jobs.length ? (
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
          {jobs.map((job) => (
            <Link key={job.id} href={`/jobs/${job.id}`}>
              <Card className="p-4 hover:border-accent/30 transition-colors cursor-pointer">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-warm-100">
                      {job.title || job.mix.filename}
                    </p>
                    <p className="text-xs text-warm-500 mt-0.5">
                      {job.mix.filename}
                      {job._count.segments > 0
                        ? ` · ${job._count.segments} сегментов`
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {job.status === "rendering" && (
                      <span className="text-xs text-warm-400">{job.progress}%</span>
                    )}
                    <StatusBadge status={job.status} />
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
