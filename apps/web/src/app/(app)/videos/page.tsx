"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader, Card, EmptyState } from "@/components/ui";
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

  useEffect(() => {
    fetch("/api/videos")
      .then((r) => r.json())
      .then(setVideos);
  }, []);

  return (
    <div>
      <PageHeader
        title="Готовые видео"
        description="Сгенерированные MP4 файлы"
      />

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
                <div>
                  <p className="text-sm font-medium text-warm-100">
                    {video.videoJob.title || video.videoJob.mix.filename}
                  </p>
                  <p className="text-xs text-warm-500 mt-0.5">
                    {formatDuration(video.durationSec)}
                    {" · "}
                    {new Date(video.createdAt).toLocaleString("ru-RU")}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {video.videoJob.youtubeUpload ? (
                    <StatusBadge status={video.videoJob.youtubeUpload.uploadStatus} />
                  ) : (
                    <Link
                      href={`/schedule?job=${video.videoJob.id}`}
                      className="btn-primary text-xs"
                    >
                      На YouTube
                    </Link>
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
