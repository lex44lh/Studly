"use client";
import { useEffect, useState } from "react";
import { ApiError, apiErrorMessage } from "@/lib/api/client";
export function useApiResource<T>(key: string, load: (signal: AbortSignal) => Promise<T>) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ key: string; data?: T; error?: unknown }>({ key: "" });
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).then(data => { if (!controller.signal.aborted) setState({ key, data }); })
      .catch(error => { if (!controller.signal.aborted) setState({ key, error }); });
    return () => controller.abort();
  }, [key, load, attempt]);
  return { data: state.key === key ? state.data : undefined, error: state.key === key ? state.error : undefined,
    retry: () => { setState({ key: "" }); setAttempt(value => value + 1); } };
}
export function ApiState({ error, retry }: { error?: unknown; retry: () => void }) {
  return error ? <div role="alert"><p>{apiErrorMessage(error)}</p>
    {!(error instanceof ApiError && error.status === 404) && <button type="button" onClick={retry}>Повторить загрузку</button>}</div>
    : <p role="status">Загрузка…</p>;
}
