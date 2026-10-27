"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { requestKey } from "@/lib/api/client";
import { assertWriteIdentity, captureIdentity, createIdentityController } from "@/lib/api/session";
import { outcomeUnknown } from "./protocol";

type Result<T> = { ok: true; value: T } | { ok: false; error: unknown };

// One write per mounted scope. A manual retry keeps the intent after an unknown
// outcome; no effect, error handler, or timer automatically replays a mutation.
export function useWrite(scope: string) {
  const { state } = useAuth();
  const identity = state.status === "authenticated" ? state.user?.id : null;
  const [lease] = useState(() => captureIdentity(identity ?? null));
  const current = useRef({ scope, identity });
  const active = useRef<AbortController | null>(null);
  const intent = useRef<{ signature: string; key: string; unknown: boolean } | null>(null);
  const [status, setStatus] = useState<{ scope: string; identity: number | null | undefined; busy: boolean; error: unknown; unknown: boolean }>({ scope, identity, busy: false, error: null, unknown: false });
  useEffect(() => {
    current.current = { scope, identity };
    return () => { active.current?.abort(); active.current = null; intent.current = null; };
  }, [scope, identity]);

  async function run<T>(signature: string, operation: (key: string, signal: AbortSignal) => Promise<T>, savedKey?: string): Promise<Result<T> | undefined> {
    if (!identity || active.current || (intent.current?.unknown && intent.current.signature !== signature)) return;
    const controller = createIdentityController(lease);
    if (controller.signal.aborted) return;
    active.current = controller;
    const attempt = intent.current?.signature === signature ? intent.current : { signature, key: savedKey ?? requestKey(), unknown: false };
    intent.current = attempt;
    setStatus({ scope, identity, busy: true, error: null, unknown: attempt.unknown });
    const valid = () => !controller.signal.aborted && current.current.scope === scope && current.current.identity === identity;
    try {
      const value = await operation(attempt.key, controller.signal);
      assertWriteIdentity(controller.signal);
      if (!valid()) return;
      intent.current = null; setStatus({ scope, identity, busy: false, error: null, unknown: false });
      return { ok: true, value };
    } catch (error) {
      if (!valid()) return;
      const unknown = outcomeUnknown(error);
      intent.current = unknown ? { ...attempt, unknown } : null;
      setStatus({ scope, identity, busy: false, error, unknown });
      return { ok: false, error };
    } finally { if (active.current === controller) active.current = null; }
  }
  const visible = status.scope === scope && status.identity === identity ? status : { busy: false, error: null, unknown: false };
  return { ...visible, run };
}
