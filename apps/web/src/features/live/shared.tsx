"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { authClient } from "@/lib/api/auth";
import { apiErrorMessage } from "@/lib/api/client";
import { demoMode } from "@/lib/data-mode";

export function LiveState({ error, loading, retry }: { error?: unknown; loading?: boolean; retry?: () => void }) {
  if (!error && !loading) return null;
  return <div className="page-panel" role={error ? "alert" : "status"} aria-busy={!!loading}>
    <p>{error ? apiErrorMessage(error) : loading ? "Загружаем данные…" : "Данных пока нет."}</p>
    {!!error && retry && <button type="button" className="secondary-btn" onClick={retry}>Повторить загрузку</button>}
  </div>;
}

function LiveSignIn() {
  const { state, refresh } = useAuth();
  const [website, setWebsite] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    authClient.options(controller.signal).then(options => { if (!controller.signal.aborted) setWebsite(options.telegram_website); }).catch(() => {});
    return () => controller.abort();
  }, []);
  return <section className="page-panel" aria-labelledby="live-sign-in-title">
    <h2 id="live-sign-in-title">Войдите в STUDLY</h2><p>{state.message}</p>
    <p>Откройте приложение в Telegram, чтобы подтвердить вход.</p>
    {website && <a className="primary-btn" href="/api/v1/auth/telegram/start/?next=%2Fprofile" onClick={event => {
      event.currentTarget.href = `/api/v1/auth/telegram/start/?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    }}>Войти через Telegram</a>}
    <button type="button" className="secondary-btn" onClick={refresh}>Повторить проверку входа</button>
    <Link href="/search">Перейти в каталог</Link>
  </section>;
}

/** No private child remains mounted across account changes or a session recheck. */
export function LiveAccess({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  if (demoMode) return <p role="status">Данные аккаунта доступны в режиме Live.</p>;
  if (state.status === "loading") return <LiveState loading />;
  if (state.status !== "authenticated" || !state.user) return <LiveSignIn />;
  return <Fragment key={`${state.user.id}:${state.identityEpoch ?? 0}`}>{children}</Fragment>;
}

/** Resource identity includes the server account; stale data is hidden during render. */
export function useLiveResource<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>) {
  const { state: auth } = useAuth();
  const scope = key === null ? null : `${auth.status}:${auth.user?.id ?? "guest"}:${auth.identityEpoch ?? 0}:${key}`;
  const [attempt, setAttempt] = useState(0);
  const requestScope = scope === null ? null : `${scope}:attempt-${attempt}`;
  const [result, setResult] = useState<{ key: string; data?: T; error?: unknown }>({ key: "" });
  const loader = useRef(load);
  useEffect(() => { loader.current = load; }, [load]);
  useEffect(() => {
    if (requestScope === null || demoMode) return;
    const controller = new AbortController();
    loader.current(controller.signal).then(data => {
      if (!controller.signal.aborted) setResult({ key: requestScope, data });
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ key: requestScope, error });
    });
    return () => controller.abort();
  }, [requestScope]);
  const current = result.key === requestScope ? result : undefined;
  return { data: current?.data, error: current?.error, loading: scope !== null && !demoMode && !current?.data && !current?.error,
    reload: () => { setResult({ key: "" }); setAttempt(value => value + 1); } };
}
