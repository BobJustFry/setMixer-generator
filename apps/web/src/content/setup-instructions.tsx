"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface InfoModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function InfoModal({ open, onClose, title, children }: InfoModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="info-modal-title"
    >
      <div
        className="card w-full max-w-lg max-h-[85vh] flex flex-col shadow-glow animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-surface-border shrink-0">
          <h2 id="info-modal-title" className="text-base font-semibold text-warm-50 pr-4">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-warm-500 hover:text-warm-200 hover:bg-surface-overlay transition-colors shrink-0"
            aria-label="Закрыть"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto text-sm text-warm-300 space-y-4 leading-relaxed">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

interface SectionHeaderProps {
  title: string;
  onInfoClick: () => void;
  children?: React.ReactNode;
}

function InfoButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="info-btn"
      title="Инструкция"
      aria-label={`Инструкция: ${label}`}
    >
      <span className="info-btn-letter" aria-hidden="true">
        i
      </span>
    </button>
  );
}

export function SectionHeader({ title, onInfoClick, children }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        <InfoButton label={title} onClick={onInfoClick} />
        <h2 className="text-sm font-medium text-warm-300">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-warm-100 font-medium mb-1.5">
        <span className="text-accent mr-2">{n}.</span>
        {title}
      </h3>
      <div className="pl-6 space-y-1.5 text-warm-400">{children}</div>
    </div>
  );
}

function Link({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent hover:underline break-all"
    >
      {children}
    </a>
  );
}

function Code({ children }: { children: string }) {
  return (
    <code className="block mt-1 px-2 py-1.5 rounded bg-surface-overlay border border-surface-border text-xs font-mono text-warm-200 break-all">
      {children}
    </code>
  );
}

export function YouTubeInstructions({ appUrl }: { appUrl: string }) {
  const jsOrigin = appUrl.trim().replace(/\/+$/, "") || "http://localhost:3000";
  const redirectUri = `${jsOrigin}/api/youtube/callback`;

  return (
    <>
      <p>
        Нужны <strong className="text-warm-200">Client ID</strong> и{" "}
        <strong className="text-warm-200">Client Secret</strong> из Google Cloud.
        Проще всего — скачать JSON при создании OAuth client и импортировать в форму.
      </p>

      <Step n={1} title="Проект и API">
        <p>
          Откройте <Link href="https://console.cloud.google.com/">Google Cloud Console</Link> и
          создайте или выберите проект.
        </p>
        <p>
          Включите{" "}
          <Link href="https://console.cloud.google.com/apis/library/youtube.googleapis.com">
            YouTube Data API v3
          </Link>
          .
        </p>
      </Step>

      <Step n={2} title="OAuth consent screen">
        <p>
          <Link href="https://console.cloud.google.com/auth/audience">Google Auth Platform → Audience</Link>{" "}
          (ранее OAuth consent screen).
        </p>
        <ul className="list-disc pl-4 space-y-1">
          <li>User Type: <strong className="text-warm-300">External</strong></li>
          <li>Заполните название приложения, support email, developer contact</li>
          <li>
            Scopes — добавьте:
            <Code>https://www.googleapis.com/auth/youtube.upload</Code>
            <Code>https://www.googleapis.com/auth/youtube.readonly</Code>
            <Code>https://www.googleapis.com/auth/youtube.force-ssl</Code>
          </li>
          <li>
            В <strong className="text-warm-300">Test users</strong> добавьте email Google-аккаунта с
            YouTube-каналом
          </li>
        </ul>
        <p className="text-xs text-warm-500 mt-1">
          Пока приложение в режиме Testing, только test users могут авторизоваться.
        </p>
      </Step>

      <Step n={3} title="OAuth Client (Web application)">
        <p>
          <Link href="https://console.cloud.google.com/auth/clients">Google Auth Platform → Clients</Link>{" "}
          → <strong className="text-warm-300">CREATE CLIENT</strong> →{" "}
          <strong className="text-warm-300">Web application</strong>.
        </p>
        <ul className="list-disc pl-4 space-y-1">
          <li>
            <strong className="text-warm-300">Authorized JavaScript origins</strong> (без пути):
            <Code>{jsOrigin}</Code>
          </li>
          <li>
            <strong className="text-warm-300">Authorized redirect URIs</strong>:
            <Code>{redirectUri}</Code>
          </li>
        </ul>
        <p className="text-xs text-amber-400/90 mt-1">
          Client Secret показывается только при создании. Сохраните JSON или скопируйте secret сразу.
        </p>
        <p className="text-xs text-warm-500 mt-1">
          Изменения в Google Console могут применяться от 5 минут до нескольких часов.
        </p>
      </Step>

      <Step n={4} title="Подключите в SetMixer">
        <ol className="list-decimal pl-4 space-y-1">
          <li>Укажите App URL (если не localhost:3000)</li>
          <li>Импортируйте JSON или вставьте Client ID и Secret вручную</li>
          <li>Нажмите <strong className="text-warm-300">Сохранить и проверить</strong></li>
          <li>Нажмите <strong className="text-warm-300">Авторизоваться в Google</strong></li>
        </ol>
        <p>Статус должен смениться на <strong className="text-green-400">Подключено</strong>.</p>
      </Step>

      <div className="pt-2 border-t border-surface-border text-xs text-warm-500 space-y-2">
        <p>
          <strong className="text-warm-400">Частые ошибки:</strong>
        </p>
        <ul className="list-disc pl-4 space-y-1">
          <li>
            <code className="text-warm-300">redirect_uri_mismatch</code> — URI в Google не совпадает с
            полями в настройках (проверьте App URL, origin и redirect)
          </li>
          <li>
            <code className="text-warm-300">access_denied</code> — email не добавлен в Test users
          </li>
          <li>
            Refresh token не получен — отзовите доступ в{" "}
            <Link href="https://myaccount.google.com/permissions">Google Account permissions</Link> и
            подключите снова
          </li>
        </ul>
        <p>
          <strong className="text-warm-400">Отложенная публикация:</strong> в «Расписании» — видимость
          «Приватное» + дата публикации.
        </p>
        <p>
          <strong className="text-warm-400">Квота API:</strong> ~10 000 units/день (~6 загрузок).
        </p>
      </div>
    </>
  );
}

export function ComfyuiInstructions() {
  return (
    <>
      <p>
        ComfyUI генерирует AI-обложки на вашей видеокарте — бесплатно и локально. Без ComfyUI
        доступны тёмный фон, градиент и загрузка своей картинки.
      </p>

      <Step n={1} title="Запустите ComfyUI">
        <p>Запустите ComfyUI Desktop на ПК — обычно <code className="text-warm-200">http://127.0.0.1:8000</code>.</p>
        <p>
          SetMixer использует <strong className="text-warm-300">Flux 2 Klein</strong> (модели в{" "}
          <code className="text-warm-200">diffusion_models/</code>, <code className="text-warm-200">text_encoders/</code>,{" "}
          <code className="text-warm-200">vae/</code>).
        </p>
      </Step>

      <Step n={2} title="URL и модель в SetMixer">
        <p>
          URL: <code className="text-warm-200">http://host.docker.internal:8000</code> (подставится автоматически из 127.0.0.1).
        </p>
        <p>Модель: выберите «Flux 2 Klein — макс. качество» в настройках.</p>
      </Step>

      <Step n={3} title="Проверка">
        <ol className="list-decimal pl-4 space-y-1">
          <li>Нажмите <strong className="text-warm-300">Сохранить и проверить</strong></li>
        </ol>
        <p>
          При успехе статус станет <strong className="text-green-400">Подключено</strong>.
        </p>
      </Step>

      <div className="pt-2 border-t border-surface-border text-xs text-warm-500">
        <p>
          Генерация: Flux Klein 1536px → масштаб до 1080p. Обложки в data/backgrounds.
        </p>
      </div>
    </>
  );
}
