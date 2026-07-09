"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Plus } from "lucide-react";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { formatFileSize, formatDuration } from "@/lib/utils";

interface Mix {
  id: string;
  filename: string;
  title: string | null;
  durationSec: number | null;
  fileSize: string | null;
  scanStatus: string;
  _count: { videoJobs: number };
}

export default function MixesPage() {
  const [mixes, setMixes] = useState<Mix[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);

  async function loadMixes() {
    const res = await fetch("/api/mixes");
    setMixes(await res.json());
  }

  async function scanFolder() {
    setLoading(true);
    await fetch("/api/mixes", { method: "POST" });
    await loadMixes();
    setLoading(false);
  }

  async function createJob(mixId: string) {
    setCreating(mixId);
    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mixId }),
    });
    if (res.ok) {
      const job = await res.json();
      window.location.href = `/jobs/${job.id}`;
    }
    setCreating(null);
  }

  useEffect(() => {
    loadMixes();
  }, []);

  return (
    <div>
      <PageHeader title="Миксы" description="Аудиофайлы из папки /data/mixes">
        <button
          onClick={scanFolder}
          disabled={loading}
          className="btn-secondary"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Сканировать
        </button>
      </PageHeader>

      {!mixes.length ? (
        <EmptyState
          title="Миксы не найдены"
          description="Положите аудиофайлы в /data/mixes и нажмите «Сканировать»"
          action={
            <button onClick={scanFolder} className="btn-primary">
              Сканировать папку
            </button>
          }
        />
      ) : (
        <div className="space-y-2">
          {mixes.map((mix) => (
            <Card key={mix.id} className="p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-warm-100 truncate">
                  {mix.title || mix.filename}
                </p>
                <p className="text-xs text-warm-500 mt-0.5">
                  {formatFileSize(mix.fileSize ? BigInt(mix.fileSize) : null)}
                  {mix.durationSec ? ` · ${formatDuration(mix.durationSec)}` : ""}
                  {mix._count.videoJobs > 0
                    ? ` · ${mix._count.videoJobs} задач`
                    : ""}
                </p>
              </div>
              <button
                onClick={() => createJob(mix.id)}
                disabled={creating === mix.id}
                className="btn-primary shrink-0"
              >
                <Plus className="w-4 h-4" />
                {creating === mix.id ? "..." : "Создать видео"}
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
