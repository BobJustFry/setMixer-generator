"use client";



import { useEffect, useRef, useState } from "react";

import { Card } from "@/components/ui";

import { LoadingButton } from "@/components/LoadingButton";

import { useTasks } from "@/components/TaskProvider";

import { InfoModal, SectionHeader, YouTubeInstructions, ComfyuiInstructions } from "@/content/setup-instructions";

import { LocalDeployCard } from "@/components/settings/LocalDeployCard";

import { COMFYUI_MODELS, DEFAULT_COMFYUI_MODEL } from "@/lib/comfyui-models";
import { parseGoogleClientJson } from "@/lib/youtube-client-json";

import { ExternalLink, CheckCircle2, XCircle, AlertCircle } from "lucide-react";



interface SettingsData {

  youtubeClientId: string;

  youtubeClientSecret: string;

  comfyuiUrl: string;

  comfyuiCheckpoint: string;

  appUrl: string;

  hasYoutubeClientSecret: boolean;

  youtube: {

    configured: boolean;

    connected: boolean;

    channelTitle: string | null;

    channelId: string | null;

  };

  comfyui: {

    configured: boolean;

    connected: boolean;

    lastError: string | null;

  };

}



interface VerifyResult {

  youtube: {

    configured: boolean;

    connected: boolean;

    credentialsValid: boolean;

    authUrl: string | null;

    channelTitle: string | null;

    error: string | null;

  };

  comfyui: {

    configured: boolean;

    connected: boolean;

    error: string | null;

    warning: string | null;

  };

}



function StatusBadge({ connected, label }: { connected: boolean; label?: string }) {

  return connected ? (

    <span className="inline-flex items-center gap-1.5 text-xs text-green-400">

      <CheckCircle2 className="w-3.5 h-3.5" />

      {label || "Подключено"}

    </span>

  ) : (

    <span className="inline-flex items-center gap-1.5 text-xs text-warm-500">

      <XCircle className="w-3.5 h-3.5" />

      {label || "Не подключено"}

    </span>

  );

}



function ConsoleLink({ href, children }: { href: string; children: React.ReactNode }) {

  return (

    <a

      href={href}

      target="_blank"

      rel="noopener noreferrer"

      className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline"

    >

      <ExternalLink className="w-3 h-3 shrink-0" />

      {children}

    </a>

  );

}



type ModalType = "youtube" | "comfyui" | null;



export function SettingsForm() {

  const [form, setForm] = useState({

    youtubeClientId: "",

    youtubeClientSecret: "",

    comfyuiUrl: "http://host.docker.internal:8000",

    comfyuiCheckpoint: DEFAULT_COMFYUI_MODEL,

    appUrl: "http://localhost:3000",

  });

  const [flags, setFlags] = useState({ hasYoutubeClientSecret: false });

  const [status, setStatus] = useState<SettingsData | null>(null);

  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

  const [loading, setLoading] = useState(false);

  const [modal, setModal] = useState<ModalType>(null);

  const [jsonImport, setJsonImport] = useState("");

  const [jsonError, setJsonError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { refresh: refreshTasks } = useTasks();

  const wizardSteps = [

    { done: !!form.appUrl, label: "App URL" },

    { done: !!(form.youtubeClientId && (form.youtubeClientSecret || flags.hasYoutubeClientSecret)), label: "Client ID / Secret" },

    { done: !!status?.youtube.connected, label: "Авторизация Google" },

  ];



  async function loadSettings() {

    const res = await fetch("/api/settings");

    const data: SettingsData = await res.json();

    setForm({

      youtubeClientId: data.youtubeClientId,

      youtubeClientSecret: "",

      comfyuiUrl: data.comfyuiUrl,

      comfyuiCheckpoint: data.comfyuiCheckpoint,

      appUrl: data.appUrl,

    });

    setFlags({

      hasYoutubeClientSecret: data.hasYoutubeClientSecret,

    });

    setStatus(data);

  }



  useEffect(() => {

    loadSettings();

  }, []);



  function applyJsonImport(raw: string) {

    setJsonImport(raw);

    setJsonError(null);

    if (!raw.trim()) return;

    try {

      const parsed = parseGoogleClientJson(raw);

      setForm((f) => ({

        ...f,

        youtubeClientId: parsed.clientId,

        youtubeClientSecret: parsed.clientSecret,

      }));

    } catch (e) {

      setJsonError(e instanceof Error ? e.message : "Ошибка импорта JSON");

    }

  }



  function onJsonFile(e: React.ChangeEvent<HTMLInputElement>) {

    const file = e.target.files?.[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => applyJsonImport(String(reader.result ?? ""));

    reader.readAsText(file);

    e.target.value = "";

  }



  async function handleVerify() {

    setLoading(true);

    setVerifyResult(null);



    const res = await fetch("/api/settings/verify", {

      method: "POST",

      headers: { "Content-Type": "application/json" },

      body: JSON.stringify(form),

    });

    const result: VerifyResult = await res.json();

    setVerifyResult(result);

    await loadSettings();

    await refreshTasks();

    setLoading(false);

  }



  return (

    <>

      <div className="space-y-4">

        <LocalDeployCard
          appUrl={form.appUrl}
          onAppUrlChange={(appUrl) => setForm({ ...form, appUrl })}
        />

        <Card>

          <SectionHeader title="YouTube" onInfoClick={() => setModal("youtube")}>

            {status && (

              <StatusBadge

                connected={status.youtube.connected}

                label={status.youtube.connected ? "Подключено" : "Не подключено"}

              />

            )}

          </SectionHeader>



          {status?.youtube.connected && (

            <p className="text-sm text-warm-100 mb-4">

              Канал: {status.youtube.channelTitle || status.youtube.channelId}

            </p>

          )}



          {!status?.youtube.connected && (

            <div className="mb-4 p-3 rounded-lg bg-surface-overlay border border-surface-border">

              <p className="text-xs text-warm-400 mb-2 font-medium">Мастер подключения</p>

              <ol className="space-y-1.5">

                {wizardSteps.map((s, i) => (

                  <li key={s.label} className="flex items-center gap-2 text-xs">

                    <span

                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${

                        s.done ? "bg-green-500/20 text-green-400" : "bg-surface-border text-warm-500"

                      }`}

                    >

                      {s.done ? <CheckCircle2 className="w-3 h-3" /> : i + 1}

                    </span>

                    <span className={s.done ? "text-warm-300" : "text-warm-500"}>{s.label}</span>

                  </li>

                ))}

              </ol>

            </div>

          )}



          <div className="mb-4 p-3 rounded-lg border border-surface-border space-y-2">

            <p className="text-xs text-warm-400 font-medium">Шаг 1 — Google Cloud Console</p>

            <div className="flex flex-wrap gap-x-4 gap-y-1">

              <ConsoleLink href="https://console.cloud.google.com/apis/library/youtube.googleapis.com">

                Включить YouTube Data API v3

              </ConsoleLink>

              <ConsoleLink href="https://console.cloud.google.com/auth/audience">

                OAuth consent screen

              </ConsoleLink>

              <ConsoleLink href="https://console.cloud.google.com/auth/clients">

                Создать OAuth Client (Web)

              </ConsoleLink>

            </div>

            <p className="text-xs text-warm-500">

              Client Secret показывается только при создании — сохраните или импортируйте JSON сразу.

            </p>

          </div>



          <div className="space-y-3">

            <div className="pt-2 border-t border-surface-border">

              <p className="text-xs text-warm-400 font-medium mb-2">Шаг 2 — Credentials</p>

              <div className="flex flex-wrap gap-2 mb-3">

                <button

                  type="button"

                  className="btn-secondary text-xs"

                  onClick={() => fileInputRef.current?.click()}

                >

                  Импорт JSON из Google

                </button>

                <input

                  ref={fileInputRef}

                  type="file"

                  accept=".json,application/json"

                  className="hidden"

                  onChange={onJsonFile}

                />

              </div>

              {jsonImport && (

                <textarea

                  className="input w-full text-xs font-mono min-h-[60px] mb-2"

                  value={jsonImport}

                  onChange={(e) => applyJsonImport(e.target.value)}

                  placeholder='{"web":{"client_id":"...","client_secret":"..."}}'

                />

              )}

              {jsonError && (

                <p className="text-xs text-red-400 mb-2 flex items-center gap-1">

                  <AlertCircle className="w-3 h-3" />

                  {jsonError}

                </p>

              )}

            </div>



            <div>

              <label className="label">Client ID</label>

              <input

                className="input"

                value={form.youtubeClientId}

                onChange={(e) => setForm({ ...form, youtubeClientId: e.target.value })}

                placeholder="xxx.apps.googleusercontent.com"

              />

            </div>

            <div>

              <label className="label">Client Secret</label>

              <input

                type="password"

                className="input"

                value={form.youtubeClientSecret}

                onChange={(e) => setForm({ ...form, youtubeClientSecret: e.target.value })}

                placeholder={

                  flags.hasYoutubeClientSecret

                    ? "••••••••  (оставьте пустым, чтобы не менять)"

                    : "Введите Client Secret"

                }

              />

            </div>

          </div>



          {verifyResult?.youtube.authUrl && !verifyResult.youtube.connected && (

            <a href={verifyResult.youtube.authUrl} className="btn-primary mt-4 inline-flex">

              <ExternalLink className="w-4 h-4" />

              Шаг 3 — Авторизоваться в Google

            </a>

          )}



          {verifyResult?.youtube.error && (

            <p className="text-xs text-red-400 mt-3 flex items-start gap-1">

              <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />

              {verifyResult.youtube.error}

            </p>

          )}

        </Card>



        <Card>

          <SectionHeader title="ComfyUI (AI-обложки)" onInfoClick={() => setModal("comfyui")}>

            {status && (

              <StatusBadge

                connected={status.comfyui.connected}

                label={status.comfyui.connected ? "Подключено" : "Не подключено"}

              />

            )}

          </SectionHeader>



          <div className="space-y-3">

            <div>

              <label className="label">URL ComfyUI</label>

              <input

                type="text"

                className="input"

                value={form.comfyuiUrl}

                onChange={(e) => setForm({ ...form, comfyuiUrl: e.target.value })}

                placeholder="http://host.docker.internal:8000"

              />

              <p className="text-[10px] text-warm-500 mt-1">
                ComfyUI в браузере: 127.0.0.1:8000 — в SetMixer укажите host.docker.internal:8000
                (127.0.0.1 подставится автоматически при сохранении)
              </p>

            </div>

            <div>

              <label className="label">Модель AI</label>

              <select
                className="input"
                value={form.comfyuiCheckpoint || DEFAULT_COMFYUI_MODEL}
                onChange={(e) => setForm({ ...form, comfyuiCheckpoint: e.target.value })}
              >
                {COMFYUI_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>

              <p className="text-[10px] text-warm-500 mt-1">
                Flux 1 Dev — лучшее качество (~1–3 мин на 1080p). Klein — быстрее.
              </p>

            </div>

          </div>



          {status?.comfyui.lastError && !status.comfyui.connected && (

            <p className="text-xs text-red-400 mt-3 whitespace-pre-wrap">{status.comfyui.lastError}</p>

          )}



          {verifyResult?.comfyui.connected && (

            <p className="text-xs text-green-400 mt-3">ComfyUI проверен успешно</p>

          )}

          {verifyResult?.comfyui.warning && (

            <p className="text-xs text-amber-400/90 mt-2">{verifyResult.comfyui.warning}</p>

          )}

          {verifyResult?.comfyui.error && (

            <p className="text-xs text-red-400 mt-3 whitespace-pre-wrap">{verifyResult.comfyui.error}</p>

          )}

        </Card>



        <Card>

          <h2 className="text-sm font-medium text-warm-300 mb-3">Пути данных</h2>

          <dl className="space-y-2 text-sm">

            <div className="flex justify-between">

              <dt className="text-warm-500">Миксы</dt>

              <dd className="text-warm-300 font-mono text-xs">data/mixes</dd>

            </div>

            <div className="flex justify-between">

              <dt className="text-warm-500">Рендеры</dt>

              <dd className="text-warm-300 font-mono text-xs">data/renders</dd>

            </div>

            <div className="flex justify-between">

              <dt className="text-warm-500">AI-обложки</dt>

              <dd className="text-warm-300 font-mono text-xs">data/backgrounds</dd>

            </div>

          </dl>

        </Card>



        <div className="flex justify-end">

          <LoadingButton onClick={handleVerify} loading={loading} loadingText="Проверка...">

            Сохранить и проверить

          </LoadingButton>

        </div>

      </div>



      <InfoModal

        open={modal === "youtube"}

        onClose={() => setModal(null)}

        title="Как подключить YouTube"

      >

        <YouTubeInstructions appUrl={form.appUrl} />

      </InfoModal>



      <InfoModal

        open={modal === "comfyui"}

        onClose={() => setModal(null)}

        title="Как подключить ComfyUI"

      >

        <ComfyuiInstructions />

      </InfoModal>

    </>

  );

}

