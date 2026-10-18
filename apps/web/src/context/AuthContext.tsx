"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import Script from "next/script";
import { authClient, getTelegramInitData, type SessionUser } from "@/lib/api/auth";
import { demoMode } from "@/lib/data-mode";
import { ApiError } from "@/lib/api/client";

type AuthState = { status: "loading" | "anonymous" | "authenticated" | "error"; user: SessionUser | null; message: string };
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

  const run = useCallback(async (logout = false) => {
    if (demoMode || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setState(previous => ({ status: "loading", user: previous.user, message: logout ? "Выходим…" : "Проверяем сессию…" }));
    try {
      if (logout) {
        await authClient.logout(controller.signal);
        loggedOut.current = true;
        verified.current = false;
        setState({ status: "anonymous", user: null, message: "Вы вышли из аккаунта." });
        return;
      }
      try {
        const { user } = await authClient.me(controller.signal);
        verified.current = true;
        setState({ status: "authenticated", user, message: "Вход подтверждён сервером." });
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
        verified.current = true;
        setState({ status: "authenticated", user, message: "Вход подтверждён сервером." });
      } else {
        setState({ status: "anonymous", user: null, message: !options.telegram_mini_app
          ? "Вход Mini App не настроен на сервере." : "Для входа откройте STUDLY в Telegram." });
      }
    } catch (error) {
      if (!controller.signal.aborted) setState({ status: "error", user: null, message: messageFor(error) });
    } finally {
      if (active.current === controller) active.current = null;
    }
  }, []);

  useEffect(() => {
    if (demoMode || verified.current) return;
    const timer = setTimeout(() => { void run(); }, 0);
    return () => clearTimeout(timer);
  }, [run, sdkReady]);
  useEffect(() => () => { active.current?.abort(); active.current = null; }, []);

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
