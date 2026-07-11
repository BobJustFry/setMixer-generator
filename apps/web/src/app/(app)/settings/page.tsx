"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader, Card } from "@/components/ui";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { decodeYouTubeError } from "@/lib/youtube-oauth-errors";
import { AlertCircle, CheckCircle2 } from "lucide-react";

function SettingsContent() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (searchParams.get("youtube_connected")) {
      setMessage({ text: "YouTube успешно подключён", ok: true });
      return;
    }
    const err = searchParams.get("youtube_error");
    if (err) {
      setMessage({ text: decodeYouTubeError(err) || err, ok: false });
    }
  }, [searchParams]);

  return (
    <div className="animate-slide-up">
      <PageHeader title="Настройки" description="Подключения и конфигурация" />

      {message && (
        <Card className={`p-4 mb-4 ${message.ok ? "border-accent/30" : "border-red-500/30"}`}>
          <p
            className={`text-sm flex items-start gap-2 ${
              message.ok ? "text-accent" : "text-red-400"
            }`}
          >
            {message.ok ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            {message.text}
          </p>
        </Card>
      )}

      <SettingsForm />
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
