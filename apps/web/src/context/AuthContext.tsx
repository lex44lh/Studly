"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import Script from "next/script";
import { authClient, getTelegramInitData, type SessionUser } from "@/lib/api/auth";
import { demoMode } from "@/lib/data-mode";
import { ApiError } from "@/lib/api/client";
import { captureIdentity, configureIdentityGuard, confirmIdentity, createIdentityController, identityChangedMessage, invalidateIdentity } from "@/lib/api/session";

type AuthState = { status: "loading" | "anonymous" | "authenticated" | "error"; user: SessionUser | null; message: string; identityEpoch?: number };
const initial: AuthState = { status: "loading", user: null, message: "Проверяем сессию…" };
const AuthContext = createContext<{ state: AuthState; sdkReady: boolean; refresh: () => void; logout: () => void } | null>(null);

function messageFor(error: unknown) {
  if (!(error instanceof ApiError)) return "Не удалось проверить вход. Повторите попытку.";
  if (error.status === 0) return error.message;
  if (error.status === 401) return "Telegram не подтвердил вход. Откройте приложение заново.";
  const code = (error.payload as { code?: string } | null)?.code;
  if (code === "csrf_failed") return "Не удалось проверить CSRF. Повторите попытку.";
  if (error.status === 403) return "Вход недоступен или сессия истекла. Повторите попытку.";
  if (error.status === 503) return "Вход через Telegram временно недоступен.";
  return "Не удалось проверить вход. Проверьте подключение API и повторите попытку.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(initial);
  const [sdkReady, setSdkReady] = useState(false);
  const active = useRef<AbortController | null>(null);
  const loggedOut = useRef(false);
  const verified = useRef(false);

  const confirmedActor = useRef<number | null>(null);
  const announce = useRef<() => void>(() => {});
  const background = useRef<AbortController | null>(null);

  const accept = useCallback((user: SessionUser) => {
    const changed = confirmedActor.current !== user.id;
    const identityEpoch = confirmIdentity(user.id);
    confirmedActor.current = user.id; verified.current = true;
    setState({ status: "authenticated", user, identityEpoch, message: "Вход подтверждён сервером." });
    if (changed) announce.current();
  }, []);

  const run = useCallback(async (logout = false) => {
    if (demoMode || active.current) return;
    background.current?.abort(); background.current = null;
    const controller = logout ? createIdentityController(captureIdentity(confirmedActor.current)) : new AbortController();
    if (controller.signal.aborted) return;
    active.current = controller;
    setState({ status: "loading", user: null, message: logout ? "Выходим…" : "Проверяем сессию…" });
    try {
      if (logout) {
        await authClient.logout(controller.signal);
        if (controller.signal.aborted) return;
        loggedOut.current = true; verified.current = false; confirmedActor.current = null;
        confirmIdentity(null); announce.current();
        setState({ status: "anonymous", user: null, message: "Вы вышли из аккаунта." });
        return;
      }
      try {
        const { user } = await authClient.me(controller.signal);
        if (!controller.signal.aborted) accept(user);
        return;
      } catch (error) {
        // Only /me/ uses 403 for an absent session. Never swallow login/CSRF 403.
        if (!(error instanceof ApiError) || ![401, 403].includes(error.status)) throw error;
      }
      const options = await authClient.options(controller.signal);
      const initData = getTelegramInitData();
      if (!loggedOut.current && options.telegram_mini_app && initData) {
        await authClient.login(initData, controller.signal);
        const { user } = await authClient.me(controller.signal);
        if (!controller.signal.aborted) { accept(user); announce.current(); }
      } else if (!controller.signal.aborted) {
        confirmIdentity(null); confirmedActor.current = null;
        setState({ status: "anonymous", user: null, message: !options.telegram_mini_app
          ? "Вход Mini App не настроен на сервере." : "Для входа откройте STUDLY в Telegram." });
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        confirmIdentity(null); confirmedActor.current = null;
        setState({ status: "error", user: null, message: messageFor(error) });
      }
    } finally {
      if (active.current === controller) active.current = null;
    }
  }, [accept]);

  useEffect(() => {
    if (demoMode) return;
    const cleanup = configureIdentityGuard({
      readActor: async signal => {
        try { return (await authClient.me(signal)).user.id; }
        catch (error) { if (error instanceof ApiError && [401, 403].includes(error.status)) return null; throw error; }
      },
      onInvalidated: () => {
        active.current?.abort(); active.current = null;
        background.current?.abort(); background.current = null;
        verified.current = false; loggedOut.current = true; confirmedActor.current = null;
        setState({ status: "error", user: null, message: identityChangedMessage });
      },
    });
    // Events are hints to re-read /me, never proof of an identity supplied by another tab.
    const check = async () => {
      if (active.current || background.current || !verified.current) return;
      const expected = confirmedActor.current;
      const controller = new AbortController(); background.current = controller;
      try {
        const { user } = await authClient.me(controller.signal);
        if (!controller.signal.aborted && !active.current && confirmedActor.current === expected && user.id !== expected) invalidateIdentity();
      } catch {
        if (!controller.signal.aborted && !active.current && confirmedActor.current === expected) invalidateIdentity();
      } finally { if (background.current === controller) background.current = null; }
    };
    const onFocus = () => { if (document.visibilityState !== "hidden") void check(); };
    const key = "studly.session.changed";
    const onStorage = (event: StorageEvent) => { if (event.key === key) void check(); };
    const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(key);
    if (channel) channel.onmessage = () => { void check(); };
    announce.current = () => {
      channel?.postMessage("changed");
      try { localStorage.setItem(key, crypto.randomUUID()); } catch { /* Broadcast/focus still work when storage is unavailable. */ }
    };
    window.addEventListener("focus", onFocus); window.addEventListener("pageshow", onFocus);
    document.addEventListener("visibilitychange", onFocus); window.addEventListener("storage", onStorage);
    return () => {
      active.current?.abort(); active.current = null; background.current?.abort(); background.current = null;
      window.removeEventListener("focus", onFocus); window.removeEventListener("pageshow", onFocus);
      document.removeEventListener("visibilitychange", onFocus); window.removeEventListener("storage", onStorage);
      announce.current = () => {}; channel?.close(); cleanup();
    };
  }, []);

  useEffect(() => {
    if (demoMode || verified.current || loggedOut.current) return;
    const timer = setTimeout(() => { void run(); }, 0);
    return () => clearTimeout(timer);
  }, [run, sdkReady]);

  return <AuthContext.Provider value={{ state: demoMode ? { status: "anonymous", user: null, message: "Демо: вход и серверная сессия не выполняются." } : state, sdkReady, refresh: () => { loggedOut.current = false; void run(); }, logout: () => { void run(true); } }}>
    {!demoMode && <Script src="https://telegram.org/js/telegram-web-app.js?64" strategy="afterInteractive"
      onReady={() => setSdkReady(true)} onError={() => setSdkReady(true)} />}
    {children}
  </AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("AuthProvider is required");
  return context;
}
