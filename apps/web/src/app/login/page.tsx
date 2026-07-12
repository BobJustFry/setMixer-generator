"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { LoadingButton } from "@/components/LoadingButton";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/dashboard";

  const [password, setPassword] = useState("");
  const [configError, setConfigError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/config")
      .then((r) => r.json())
      .then((data) => {
        if (!data.passwordConfigured) {
          setConfigError("APP_PASSWORD не задан на сервере");
        }
      })
      .catch(() => setConfigError("Не удалось загрузить настройки входа"));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        router.push(nextPath.startsWith("/") ? nextPath : "/dashboard");
        router.refresh();
        return;
      }

      setError(data.error || "Ошибка входа");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface">
      <div className="card w-full max-w-sm p-8 border border-surface-border">
        <div className="mb-8 text-center">
          <div className="flex justify-center mb-4">
            <Image
              src="/logo.png"
              alt="setmix.er"
              width={56}
              height={56}
              className="rounded-full shadow-glow"
              priority
            />
          </div>
          <h1 className="text-xl font-semibold text-warm-50 tracking-tight">setmix.er Generator</h1>
          <p className="text-sm text-warm-400 mt-1">Вход в панель управления</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="password">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              autoFocus
              disabled={Boolean(configError)}
            />
          </div>

          {configError && <p className="text-sm text-red-400 text-center">{configError}</p>}
          {error && <p className="text-sm text-red-400 text-center">{error}</p>}

          <p className="text-xs text-warm-600 text-center">
            После 5 неверных попыток с одного IP — блокировка на 30 минут.
          </p>

          <LoadingButton
            type="submit"
            loading={loading}
            loadingText="Вход..."
            className="w-full mt-2"
            disabled={Boolean(configError)}
          >
            Войти
          </LoadingButton>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface" />}>
      <LoginForm />
    </Suspense>
  );
}
