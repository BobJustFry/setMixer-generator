"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { LoadingButton } from "@/components/LoadingButton";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDuration } from "@/lib/utils";

interface Video {
  id: string;
  outputPath: string;
  durationSec: number | null;
  createdAt: string;
  videoJob: {
    id: string;
    title: string | null;
    mix: { filename: string };
    youtubeUpload: { uploadStatus: string; youtubeVideoId: string | null } | null;
  };
}

export default function VideosPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function loadVideos() {
    const res = await fetch("/api/videos");
    if (res.ok) setVideos(await res.json());
  }

  useEffect(() => {
    loadVideos();
  }, []);

  async function deleteVideo(video: Video) {
    if (!confirm(`Удалить «${video.videoJob.title || video.videoJob.mix.filename}»?`)) return;
    setDeleting(video.id);
    try {
      const res = await fetch(`/api/videos/${video.id}`, { method: "DELETE" });
      if (res.ok) {
        await loadVideos();
      } else {
        const data = await res.json();
        alert(data.error || "Не удалось удалить");
      }
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div>
      <PageHeader title="Готовые видео" description="Сгенерированные MP4 файлы" />

      {!videos.length ? (
        <EmptyState
          title="Видео пока нет"
          description="Создайте задачу и дождитесь завершения рендера"
        />
      ) : (
        <div className="space-y-2">
          {videos.map((video) => (
            <Card key={video.id} className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <Link
                    href={`/jobs/${video.videoJob.id}`}
                    className="text-sm font-medium text-warm-100 hover:text-accent truncate block"
                  >
                    {video.videoJob.title || video.videoJob.mix.filename}
                  </Link>
                  <p className="text-xs text-warm-500 mt-0.5">
                    {formatDuration(video.durationSec)}
                    {" · "}
                    {new Date(video.createdAt).toLocaleString("ru-RU")}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {video.videoJob.youtubeUpload?.youtubeVideoId ? (
                    <StatusBadge status={video.videoJob.youtubeUpload.uploadStatus} />
                  ) : (
                    <>
                      <Link
                        href={`/schedule?job=${video.videoJob.id}`}
                        className="btn-primary text-xs"
                      >
                        На YouTube
                      </Link>
                      <LoadingButton
                        onClick={() => deleteVideo(video)}
                        loading={deleting === video.id}
                        loadingText="..."
                        variant="secondary"
                        className="text-xs"
                        title="Удалить видео"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </LoadingButton>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
