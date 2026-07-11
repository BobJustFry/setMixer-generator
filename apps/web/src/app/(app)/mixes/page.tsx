"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { LoadingButton } from "@/components/LoadingButton";
import { CreateVideoModal } from "@/components/mixes/CreateVideoModal";
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
  const [scanning, setScanning] = useState(false);
  const [pickMix, setPickMix] = useState<Mix | null>(null);
  const [aiAvailable, setAiAvailable] = useState(false);

  async function loadMixes() {
    const res = await fetch("/api/mixes");
    setMixes(await res.json());
  }

  async function loadSettings() {
    const res = await fetch("/api/settings");
    if (res.ok) {
      const data = await res.json();
      setAiAvailable(!!data.comfyui?.configured || !!data.comfyui?.connected);
    }
  }

  async function scanFolder() {
    setScanning(true);
    await fetch("/api/mixes", { method: "POST" });
    await loadMixes();
    setScanning(false);
  }

  useEffect(() => {
    loadMixes();
    loadSettings();
  }, []);

  return (
    <div className="animate-slide-up">
      <PageHeader title="Миксы" description="Аудиофайлы из папки data/mixes">
        <LoadingButton
          onClick={scanFolder}
          loading={scanning}
          loadingText="Сканирование..."
          variant="secondary"
        >
          Сканировать
        </LoadingButton>
      </PageHeader>

      {!mixes.length ? (
        <EmptyState
          title="Миксы не найдены"
          description="Положите аудиофайлы в data/mixes и нажмите «Сканировать»"
          action={
            <LoadingButton onClick={scanFolder} loading={scanning} loadingText="Сканирование...">
              Сканировать папку
            </LoadingButton>
          }
        />
      ) : (
        <div className="space-y-2">
          {mixes.map((mix) => (
            <Card key={mix.id} className="p-4 flex items-center justify-between gap-4 animate-fade-in">
              <div className="min-w-0">
                <p className="text-sm font-medium text-warm-100 truncate">
                  {mix.title || mix.filename}
                </p>
                <p className="text-xs text-warm-500 mt-0.5">
                  {formatFileSize(mix.fileSize ? BigInt(mix.fileSize) : null)}
                  {mix.durationSec ? ` · ${formatDuration(mix.durationSec)}` : ""}
                  {mix._count.videoJobs > 0 ? ` · ${mix._count.videoJobs} задач` : ""}
                </p>
              </div>
              <LoadingButton onClick={() => setPickMix(mix)} className="shrink-0">
                <Plus className="w-4 h-4" />
                Создать видео
              </LoadingButton>
            </Card>
          ))}
        </div>
      )}

      {pickMix && (
        <CreateVideoModal
          mix={pickMix}
          aiAvailable={aiAvailable}
          onClose={() => setPickMix(null)}
          onCreated={(jobId) => {
            setPickMix(null);
            window.location.href = `/jobs/${jobId}`;
          }}
        />
      )}
    </div>
  );
}
