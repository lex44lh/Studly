"use client";

import { DemoRegistrationBridge } from "@/features/demo-workspace/RegistrationAdapter";
import { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState, type Dispatch, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { demoMode } from "@/lib/data-mode";
import { useAuth } from "@/context/AuthContext";
import { registrationClient, toDraft } from "@/lib/api/registration";
import { authClient } from "@/lib/api/auth";
import { apiErrorMessage, ApiError } from "@/lib/api/client";
import { createDraftState, draftReducer, type DraftAction } from "@/lib/registration/draft";
import type { RegistrationDraft } from "@/types/registration";
import type { RegistrationResponse, RegistrationStep } from "@/types/registration-api";

const RegistrationContext = createContext<{
  draft: RegistrationDraft; dispatch: Dispatch<DraftAction>; client: typeof registrationClient;
  previewComplete: boolean; returnToForm: () => void; ready: boolean; loading: boolean; busy: boolean; error: string; retry: () => void;
  saveStep: (step: RegistrationStep, skip?: boolean) => Promise<void>;
} | null>(null);

function validationMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 400 && error.payload && typeof error.payload === "object") {
    const collect = (value: unknown): string[] => typeof value === "string" ? [value] : Array.isArray(value)
      ? value.flatMap(collect) : value && typeof value === "object" ? Object.values(value).flatMap(collect) : [];
    return collect(error.payload).join(" ") || apiErrorMessage(error);
  }
  return apiErrorMessage(error);
}

function RegistrationSession({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(draftReducer, undefined, createDraftState);
  const { state: auth } = useAuth();
  const router = useRouter();
  const [previewComplete, setPreviewComplete] = useState(false);
  const [ready, setReady] = useState(demoMode);
  const [loading, setLoading] = useState(!demoMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const server = useRef<RegistrationResponse | null>(null);
  const active = useRef<AbortController | null>(null);
  const draft = state.draft;

  useEffect(() => {
    if (demoMode || auth.status !== "authenticated") return;
    const controller = new AbortController();
    registrationClient.loadDraft(controller.signal).then(value => {
      if (controller.signal.aborted) return;
      server.current = value;
      setReady(true);
      dispatch({ type: "restore", draft: toDraft(value) });
      setError(""); setLoading(false);
      if (value.status.is_complete) { router.replace("/"); return; }
      const step = !value.roles.length ? "roles" : !value.profile.display_name.trim() && value.progress.current_step === "performer"
        ? "profile" : value.progress.current_step === "performer" && !value.roles.includes("performer") ? "profile" : value.progress.current_step;
      router.replace(`/register/${step}`);
    }).catch(error => {
      if (!controller.signal.aborted) { setError(validationMessage(error)); setLoading(false); }
    });
    return () => { controller.abort(); active.current?.abort(); active.current = null; };
  }, [auth.status, auth.user?.id, attempt, router]);

  const avatarUrl = draft.profile.avatarUrl;
  useEffect(() => () => { if (avatarUrl.startsWith("blob:")) URL.revokeObjectURL(avatarUrl); }, [avatarUrl]);
  const saveStep = useCallback(async (step: RegistrationStep, skip = false) => {
    if (demoMode) {
      if (step === "roles") router.push("/register/profile");
      else if (step === "profile" && draft.roles.includes("performer")) router.push("/register/performer");
      else setPreviewComplete(true);
      return;
    }
    if (active.current || loading || auth.status !== "authenticated" || !server.current) return;
    const controller = new AbortController(); active.current = controller;
    setBusy(true); setError("");
    try {
      let response: RegistrationResponse;
      if (step === "roles") {
        response = await registrationClient.save({ roles: draft.roles, progress: { current_step: "profile" } }, controller.signal);
        server.current = response;
        if (!controller.signal.aborted) router.push("/register/profile");
        return;
      }
      if (step === "profile") {
        if (draft.profile.avatarFile) {
          const uploaded = await registrationClient.uploadAvatar(draft.profile.avatarFile, controller.signal);
          server.current = uploaded;
          if (!controller.signal.aborted) dispatch({ type: "profile", patch: { avatarFile: null, avatarUrl: `${uploaded.profile.avatar_url}?v=${Date.now()}` } });
        } else if (!draft.profile.avatarUrl && server.current.profile.avatar_url) {
          await registrationClient.deleteAvatar(controller.signal);
          server.current = { ...server.current, profile: { ...server.current.profile, avatar_url: null } };
        }
        const performer = draft.roles.includes("performer");
        response = await registrationClient.save({ profile: { display_name: draft.profile.displayName, university: draft.profile.university,
          city: draft.profile.city, about: draft.profile.about }, progress: { current_step: performer ? "performer" : "profile" } }, controller.signal);
        server.current = response;
        if (performer) { if (!controller.signal.aborted) router.push("/register/performer"); return; }
      } else {
        response = await registrationClient.save({ ...(skip ? {} : { performer: {
          description: draft.performer.description, study_year: draft.performer.studyYear, portfolio: draft.performer.portfolio,
          specialization_ids: draft.performer.specializations.map(item => item.id),
        } }), progress: { current_step: "performer", performer_skipped: skip } }, controller.signal);
        server.current = response;
      }
      server.current = await registrationClient.complete(controller.signal);
      if (!controller.signal.aborted) router.replace("/");
    } catch (error) {
      if (!controller.signal.aborted) {
        setError(validationMessage(error));
        // Read-only diagnostic on 403; never replay a write automatically.
        if (error instanceof ApiError && [401, 403].includes(error.status)) {
          try { await authClient.me(controller.signal); }
          catch { if (!controller.signal.aborted) setError("Сессию не удалось подтвердить. Выполните вход заново; несохранённые поля остаются в этой вкладке."); }
        }
      }
    } finally {
      if (active.current === controller) { active.current = null; setBusy(false); }
    }
  }, [draft, loading, auth.status, router]);

  return <RegistrationContext.Provider value={{ draft, dispatch, client: registrationClient, previewComplete, returnToForm: () => setPreviewComplete(false), ready, loading, busy, error,
    retry: () => { setLoading(true); setError(""); setAttempt(value => value + 1); }, saveStep }}>{children}</RegistrationContext.Provider>;
}
export function useRegistration() {
  const context = useContext(RegistrationContext);
  if (!context) throw new Error("RegistrationProvider is required");
  return context;
}

export function RegistrationProvider({ children }: { children: ReactNode }) {
  const { state: auth } = useAuth();
  if (demoMode) return <DemoRegistrationBridge context={RegistrationContext}>{children}</DemoRegistrationBridge>;
  return <RegistrationSession key={auth.user?.id ?? "anonymous"}>{children}</RegistrationSession>;
}
