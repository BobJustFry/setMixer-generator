"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader, Card } from "@/components/ui";
import { StatusBadge } from "@/components/StatusBadge";

interface DashboardData {
  stats: {
    mixCount: number;
    jobCount: number;
    videoCount: number;
    scheduledCount: number;
  };
  recentJobs: Array<{
    id: string;
    title: string | null;
    status: string;
    mix: { filename: string };
  }>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData);
  }, []);

  const stats = data?.stats;

  return (
    <div>
      <PageHeader
        title="Обзор"
        description="Статус генератора видео SetMixer"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Миксы", value: stats?.mixCount ?? "—" },
          { label: "Задачи", value: stats?.jobCount ?? "—" },
          { label: "Видео", value: stats?.videoCount ?? "—" },
          { label: "В расписании", value: stats?.scheduledCount ?? "—" },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs text-warm-500 uppercase tracking-wider">{s.label}</p>
            <p className="text-2xl font-semibold text-warm-50 mt-1">{s.value}</p>
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="text-sm font-medium text-warm-300 mb-4">Последние задачи</h2>
        {!data?.recentJobs?.length ? (
          <p className="text-sm text-warm-500">Задач пока нет</p>
        ) : (
          <div className="space-y-2">
            {data.recentJobs.map((job) => (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-overlay transition-colors"
              >
                <div>
                  <p className="text-sm text-warm-100">{job.title || job.mix.filename}</p>
                  <p className="text-xs text-warm-500">{job.mix.filename}</p>
                </div>
                <StatusBadge status={job.status} />
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
