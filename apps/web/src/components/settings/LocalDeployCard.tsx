"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { LoadingButton } from "@/components/LoadingButton";
import { CopyField } from "@/components/settings/CopyField";
import {
  youtubeJavaScriptOrigin,
  youtubeRedirectUri,
} from "@/lib/youtube-oauth-errors";
import { AlertCircle } from "lucide-react";

interface NetworkInfo {
  localhostUrl: string;
  lanIp: string | null;
  lanUrl: string | null;
  publicIp: string | null;
  publicUrl: string | null;
  port: string;
  comfyuiUsesWebhooks: boolean;
  notes: {
    oauth: string;
    comfyui: string;
    youtubeUpload: string;
    portForward: string;
  };
}

interface LocalDeployCardProps {
  appUrl: string;
  onAppUrlChange: (url: string) => void;
}

export function LocalDeployCard({ appUrl, onAppUrlChange }: LocalDeployCardProps) {
  const [network, setNetwork] = useState<NetworkInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function detectNetwork() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/network");
      if (!res.ok) throw new Error("Не удалось определить сеть");
      const data: NetworkInfo = await res.json();
      setNetwork(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  const jsOrigin = youtubeJavaScriptOrigin(appUrl);
  const redirectUri = youtubeRedirectUri(appUrl);

  return (
    <Card>
      <h2 className="text-sm font-medium text-warm-300 mb-2">Локальный запуск</h2>
      <p className="text-xs text-warm-500 mb-3 leading-relaxed">
        Приложение работает на вашем ПК. YouTube <strong className="text-warm-400">не подключается</strong>{" "}
        к вам как к серверу — OAuth идёт через браузер. ComfyUI работает локально на вашей видеокарте.
        Проброс порта нужен только если открываете UI с другого устройства.
      </p>

      <div className="flex flex-wrap gap-2 mb-3">
        <LoadingButton
          type="button"
          onClick={detectNetwork}
          loading={loading}
          loadingText="..."
          variant="secondary"
          className="text-xs"
        >
          Определить IP
        </LoadingButton>
        {network?.localhostUrl && (
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={() => onAppUrlChange(network.localhostUrl)}
          >
            Подставить localhost
          </button>
        )}
        {network?.lanUrl && (
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={() => onAppUrlChange(network.lanUrl!)}
          >
            Подставить LAN ({network.lanIp})
          </button>
        )}
        {network?.publicUrl && (
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={() => onAppUrlChange(network.publicUrl!)}
          >
            Подставить внешний IP
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-400 mb-2 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}

      {network && (
        <dl className="text-xs space-y-1 mb-3 text-warm-500">
          <div className="flex justify-between gap-2">
            <dt>localhost</dt>
            <dd className="font-mono text-warm-300">{network.localhostUrl}</dd>
          </div>
          {network.lanUrl && (
            <div className="flex justify-between gap-2">
              <dt>LAN</dt>
              <dd className="font-mono text-warm-300">{network.lanUrl}</dd>
            </div>
          )}
          {network.publicIp && (
            <div className="flex justify-between gap-2">
              <dt>Внешний IP</dt>
              <dd className="font-mono text-warm-300">{network.publicIp}</dd>
            </div>
          )}
        </dl>
      )}

      <div className="space-y-2 pt-2 border-t border-surface-border">
        <div>
          <label className="label">App URL</label>
          <input
            className="input font-mono text-xs"
            value={appUrl}
            onChange={(e) => onAppUrlChange(e.target.value)}
            placeholder="http://localhost:3000"
          />
        </div>
        <p className="text-xs text-warm-500">
          При смене App URL обновите Origin и Redirect в Google Console. Порт{" "}
          <code className="text-warm-300">{network?.port ?? "3000"}</code> должен быть проброшен на
          роутере, если используете LAN/внешний IP.
        </p>
        <CopyField label="JavaScript origin для Google" value={jsOrigin} />
        <CopyField label="Redirect URI для Google" value={redirectUri} />
      </div>

      {network?.notes && (
        <ul className="mt-3 text-xs text-warm-500 space-y-1 list-disc pl-4">
          <li>{network.notes.oauth}</li>
          <li>{network.notes.comfyui}</li>
          <li>{network.notes.youtubeUpload}</li>
          <li>{network.notes.portForward}</li>
        </ul>
      )}
    </Card>
  );
}
