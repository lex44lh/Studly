"use client";

import { useCallback, useMemo, useSyncExternalStore, type CSSProperties } from "react";

export type CampusTheme = "auto" | "light" | "dark";

export type CampusPlatformStyle = CSSProperties & {
  "--studly-safe-top": string;
  "--studly-safe-bottom": string;
  "--studly-safe-left": string;
  "--studly-safe-right": string;
  "--studly-viewport-height": string;
};

export type CampusPlatform = {
  /** `auto` lets CSS follow the system theme when Telegram is unavailable. */
  theme: CampusTheme;
  style: CampusPlatformStyle;
};

type MediaQuery = {
  matches: boolean;
  addEventListener?: (event: "change", listener: () => void) => void;
  removeEventListener?: (event: "change", listener: () => void) => void;
  addListener?: (listener: () => void) => void;
  removeListener?: (listener: () => void) => void;
};

type PlatformEnvironment = {
  Telegram?: { WebApp?: unknown };
  matchMedia?: (query: string) => MediaQuery;
};

type Snapshot = [CampusTheme, number, number, string, boolean, number, number];
const SERVER_SNAPSHOT = JSON.stringify(["auto", 0, 0, "100svh", false, 0, 0] satisfies Snapshot);
const EVENTS = ["themeChanged", "viewportChanged", "safeAreaChanged", "contentSafeAreaChanged"] as const;

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : undefined;
}

function telegramApp(value: unknown): Record<string, unknown> | undefined {
  const app = record(value);
  // Loading the public SDK in an ordinary browser also creates a WebApp stub.
  return app?.platform === "unknown" ? undefined : app;
}

function inset(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

function height(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function environment(): PlatformEnvironment | undefined {
  return typeof window === "undefined" ? undefined : window as unknown as PlatformEnvironment;
}

function systemQuery(browser: PlatformEnvironment | undefined): MediaQuery | undefined {
  if (typeof browser?.matchMedia !== "function") return undefined;
  try {
    return browser.matchMedia("(prefers-color-scheme: dark)");
  } catch {
    return undefined;
  }
}

/** Only display metadata is read: no initData, identity, authorization or SDK mutations. */
export function createCampusPlatformSnapshot(webApp?: unknown, systemDark = false): string {
  const app = telegramApp(webApp);
  const safe = record(app?.safeAreaInset);
  const content = record(app?.contentSafeAreaInset);
  const theme: CampusTheme = app?.colorScheme === "dark" || app?.colorScheme === "light"
    ? app.colorScheme : "auto";
  // Telegram recommends the stable height for bottom-anchored UI, rather than gesture frames.
  const viewport = height(app?.viewportStableHeight) ?? height(app?.viewportHeight);
  return JSON.stringify([
    theme,
    Math.max(inset(safe?.top), inset(content?.top)),
    Math.max(inset(safe?.bottom), inset(content?.bottom)),
    viewport === undefined ? "100svh" : `${viewport}px`,
    systemDark,
    Math.max(inset(safe?.left), inset(content?.left)),
    Math.max(inset(safe?.right), inset(content?.right)),
  ] satisfies Snapshot);
}

/** A primitive, stable SSR snapshot also used for the first hydration render. */
export function getServerCampusPlatformSnapshot(): string {
  return SERVER_SNAPSHOT;
}

export function getCampusPlatformSnapshot(): string {
  const browser = environment();
  if (!browser) return SERVER_SNAPSHOT;
  return createCampusPlatformSnapshot(browser.Telegram?.WebApp, systemQuery(browser)?.matches === true);
}

/** Listen only when matching removal APIs exist; unsupported optional SDK events are harmless. */
export function subscribeCampusPlatform(
  onChange: () => void,
  browser: PlatformEnvironment | undefined = environment(),
): () => void {
  const cleanups: Array<() => void> = [];
  const app = telegramApp(browser?.Telegram?.WebApp);
  if (typeof app?.onEvent === "function" && typeof app.offEvent === "function") {
    const onEvent = app.onEvent as (event: string, listener: () => void) => void;
    const offEvent = app.offEvent as (event: string, listener: () => void) => void;
    for (const event of EVENTS) {
      try {
        onEvent.call(app, event, onChange);
        cleanups.push(() => offEvent.call(app, event, onChange));
      } catch {
        // Older clients may not implement the safe-area events.
      }
    }
  }
  const query = systemQuery(browser);
  if (typeof query?.addEventListener === "function" && typeof query.removeEventListener === "function") {
    query.addEventListener("change", onChange);
    cleanups.push(() => query.removeEventListener?.("change", onChange));
  } else if (typeof query?.addListener === "function" && typeof query.removeListener === "function") {
    query.addListener(onChange);
    cleanups.push(() => query.removeListener?.(onChange));
  }
  return () => {
    for (const cleanup of cleanups.splice(0)) {
      try { cleanup(); } catch { /* A detached WebView must not prevent remaining cleanup. */ }
    }
  };
}

export function useCampusPlatform(sdkReady: boolean): CampusPlatform {
  // AuthProvider owns loading the SDK. Its readiness change reconnects the external-store listeners.
  const subscribe = useCallback((onChange: () => void) => {
    void sdkReady;
    return subscribeCampusPlatform(onChange);
  }, [sdkReady]);
  const snapshot = useSyncExternalStore(subscribe, getCampusPlatformSnapshot, getServerCampusPlatformSnapshot);
  return useMemo(() => {
    const [theme, top, bottom, viewport, , left, right] = JSON.parse(snapshot) as Snapshot;
    return {
      theme,
      style: {
        "--studly-safe-top": `${top}px`,
        "--studly-safe-bottom": `${bottom}px`,
        "--studly-safe-left": `${left}px`,
        "--studly-safe-right": `${right}px`,
        "--studly-viewport-height": viewport,
      },
    };
  }, [snapshot]);
}
