"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader, Card } from "@/components/ui";
import { ExternalLink } from "lucide-react";

interface YouTubeStatus {
  connected: boolean;
  channelTitle: string | null;
  channelId: string | null;
  authUrl: string | null;
}

function SettingsContent() {
  const searchParams = useSearchParams();
  const [yt, setYt] = useState<YouTubeStatus | null>(null);
  const message = searchParams.get("youtube_connected")
    ? "YouTube подключён"
    : searchParams.get("youtube_error");

  useEffect(() => {
    fetch("/api/youtube/status")
      .then((r) => r.json())
      .then(setYt);
  }, []);

  return (
    <div>
      <PageHeader title="Настройки" description="Подключения и конфигурация" />

      {message && (
        <Card className="p-4 mb-4 border-accent/30">
          <p className="text-sm text-accent">{message}</p>
        </Card>
      )}

      <div className="space-y-4">
        <Card>
          <h2 className="text-sm font-medium text-warm-300 mb-3">YouTube</h2>
          {yt?.connected ? (
            <div>
              <p className="text-sm text-warm-100">
                Канал: {yt.channelTitle || yt.channelId}
              </p>
              <p className="text-xs text-green-400 mt-1">Подключено</p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-warm-500 mb-3">
                Подключите YouTube для автоматической публикации
              </p>
              {yt?.authUrl && (
                <a href={yt.authUrl} className="btn-primary">
                  <ExternalLink className="w-4 h-4" />
                  Подключить YouTube
                </a>
              )}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-medium text-warm-300 mb-3">Пути данных</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-warm-500">Миксы</dt>
              <dd className="text-warm-300 font-mono text-xs">/data/mixes</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-warm-500">Рендеры</dt>
              <dd className="text-warm-300 font-mono text-xs">/data/renders</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-warm-500">Обложки</dt>
              <dd className="text-warm-300 font-mono text-xs">/data/thumbs</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <h2 className="text-sm font-medium text-warm-300 mb-3">Переменные окружения</h2>
          <p className="text-xs text-warm-500">
            Настройте <code className="text-warm-400">.env</code> на сервере:
            YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, REPLICATE_API_TOKEN,
            SESSION_SECRET, ENCRYPTION_KEY, ADMIN_EMAIL, ADMIN_PASSWORD
          </p>
        </Card>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<p className="text-warm-500">Загрузка...</p>}>
      <SettingsContent />
    </Suspense>
  );
}
