"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, apiErrorMessage } from "@/lib/api/client";
import { captureIdentity, createIdentityController } from "@/lib/api/session";
import { OwnRevisionUnconfirmedError } from "./revisions";

export function accountError(error: unknown): string {
  if (error instanceof OwnRevisionUnconfirmedError) return error.message;
  if (error instanceof ApiError && error.status === 400 && error.payload && typeof error.payload === "object") {
    const collect = (value: unknown): string[] => typeof value === "string" ? [value] : Array.isArray(value) ? value.flatMap(collect)
      : value && typeof value === "object" ? Object.values(value).flatMap(collect) : [];
    return collect(error.payload).join(" ") || apiErrorMessage(error);
  }
  return apiErrorMessage(error);
}

/** One account-wide writer. Unknown versioned results keep the original closure/key/payload. */
export function useAccountWriter(reload: () => void, expectedActorId: number | null = null) {
  const [identity] = useState(() => captureIdentity(expectedActorId));
  const active = useRef<AbortController | null>(null);
  const pending = useRef<{ work: (signal: AbortSignal) => Promise<unknown>; replayable: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [replayable, setReplayable] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => () => { active.current?.abort(); active.current = null; pending.current = null; }, []);
  async function execute(work: (signal: AbortSignal) => Promise<unknown>, canReplay = true, retry = false): Promise<boolean> {
    if (active.current || (pending.current && !retry)) return false;
    const controller = createIdentityController(identity);
    if (controller.signal.aborted) { pending.current = null; return false; }
    active.current = controller;
    setBusy(true); setError(""); setNotice("");
    try {
      await work(controller.signal);
      if (controller.signal.aborted) return false;
      pending.current = null; setUncertain(false); setReplayable(false);
      setNotice("Изменения подтверждены сервером. Загружаем актуальные данные."); reload(); return true;
    } catch (cause) {
      if (!controller.signal.aborted) {
        const unknown = !(cause instanceof ApiError) || cause.status === 0 || cause.status >= 500;
        pending.current = unknown ? { work, replayable: canReplay } : null;
        setUncertain(unknown); setReplayable(unknown && canReplay);
        setError(`${accountError(cause)}${unknown ? " Результат операции не подтверждён. Новые изменения приостановлены." : ""}`);
      }
      return false;
    } finally {
      if (active.current === controller) { active.current = null; setBusy(false); }
    }
  }
  return {
    busy, blocked: busy || uncertain, uncertain, replayable, error, notice, execute,
    retry: () => { const saved = pending.current; if (saved?.replayable) void execute(saved.work, true, true); },
    refresh: () => {
      if (active.current) return;
      pending.current = null; setUncertain(false); setReplayable(false); setError(""); setNotice(""); reload();
    },
  };
}
export type AccountWriter = ReturnType<typeof useAccountWriter>;
