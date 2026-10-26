"use client";

import { DemoRegistrationBridge } from "@/features/demo-workspace/RegistrationAdapter";
import { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState, type Dispatch, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { demoMode } from "@/lib/data-mode";
import { useAuth } from "@/context/AuthContext";
import { registrationClient, registrationModeratedFields, registrationRevisionAfterSave, toDraft } from "@/lib/api/registration";
import { accountClient } from "@/lib/api/account";
import { authClient } from "@/lib/api/auth";
import { apiErrorMessage, ApiError } from "@/lib/api/client";
import { createDraftState, draftReducer, type DraftAction } from "@/lib/registration/draft";
import type { RegistrationDraft } from "@/types/registration";
import type { RegistrationResponse, RegistrationStep } from "@/types/registration-api";
import type { RegistrationPatch } from "@/types/registration-api";

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
  const performerRevision = useRef<number | null>(null);
  const active = useRef<AbortController | null>(null);
  const draft = state.draft;

  useEffect(() => {
    if (demoMode || auth.status !== "authenticated") return;
    const controller = new AbortController();
    accountClient.registrationSnapshot(controller.signal).then(({ registration: value, moderation }) => {
      if (controller.signal.aborted) return;
      if (moderation.user_id !== auth.user?.id) throw new ApiError(409, { code: "profile_snapshot_changed" });
      server.current = value;
      performerRevision.current = moderation.revision;
      setReady(true);
      dispatch({ type: "restore", draft: toDraft(value) });
      setError(""); setLoading(false);
      if (value.status.is_complete) { router.replace("/profile"); return; }
      const step = !value.roles.length ? "roles" : !value.profile.display_name.trim() && value.progress.current_step === "performer"
        ? "profile" : value.progress.current_step === "performer" && !value.roles.includes("performer") ? "profile" : value.progress.current_step;
      router.replace(`/register/${step}`);
    }).catch(error => {
      if (!controller.signal.aborted) { performerRevision.current = null; setReady(false); setError(validationMessage(error)); setLoading(false); }
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
    if (active.current || loading || auth.status !== "authenticated" || !server.current || performerRevision.current === null) return;
    const controller = new AbortController(); active.current = controller;
    setBusy(true); setError("");
    try {
      const saveGuarded = async (patch: RegistrationPatch) => {
        const before = server.current!;
        const revision = performerRevision.current!;
        const value = await registrationClient.save({ ...patch, performer_revision: revision }, controller.signal);
        const expected = registrationRevisionAfterSave(before, value, revision);
        // A successful PATCH response is canonical, but a following GET can already
        // contain another writer's revision. Accept only this operation's exact touch.
        performerRevision.current = null;
        const observed = await accountClient.moderation(controller.signal);
        if (observed.user_id !== auth.user?.id || observed.revision !== expected) {
          throw new ApiError(409, { code: "profile_changed_after_save" });
        }
        server.current = value; performerRevision.current = expected;
        return value;
      };
      let response: RegistrationResponse;
      if (step === "roles") {
        response = await saveGuarded({ roles: draft.roles, progress: { current_step: "profile" } });
        server.current = response;
        if (!controller.signal.aborted) router.push("/register/profile");
        return;
      }
      if (step === "profile") {
        if (draft.profile.avatarFile) {
          const hadPerformer = server.current.performer !== null;
          const before = registrationModeratedFields(server.current);
          const uploaded = await registrationClient.uploadAvatar(draft.profile.avatarFile, controller.signal);
          if (registrationModeratedFields(uploaded) !== before) {
            performerRevision.current = null;
            throw new ApiError(409, { code: "profile_changed_during_avatar" });
          }
          server.current = uploaded;
          // Avatar v1 has no revision input. Advance only its known own touch, not a later observed revision.
          if (hadPerformer) performerRevision.current! += 1;
          if (!controller.signal.aborted) dispatch({ type: "profile", patch: { avatarFile: null, avatarUrl: `${uploaded.profile.avatar_url}?v=${Date.now()}` } });
        } else if (!draft.profile.avatarUrl && server.current.profile.avatar_url) {
          const hadPerformer = server.current.performer !== null;
          await registrationClient.deleteAvatar(controller.signal);
          if (hadPerformer) performerRevision.current! += 1;
          server.current = { ...server.current, profile: { ...server.current.profile, avatar_url: null } };
        }
        const performer = draft.roles.includes("performer");
        response = await saveGuarded({ profile: { display_name: draft.profile.displayName, university: draft.profile.university,
          city: draft.profile.city, about: draft.profile.about }, progress: { current_step: performer ? "performer" : "profile" } });
        server.current = response;
        if (performer) { if (!controller.signal.aborted) router.push("/register/performer"); return; }
      } else {
        response = await saveGuarded({ ...(skip ? {} : { performer: {
          description: draft.performer.description, study_year: draft.performer.studyYear, portfolio: draft.performer.portfolio,
          specialization_ids: draft.performer.specializations.map(item => item.id),
        } }), progress: { current_step: "performer", performer_skipped: skip } });
        server.current = response;
      }
      server.current = await registrationClient.complete(controller.signal);
      if (!controller.signal.aborted) router.replace("/profile");
    } catch (error) {
      if (!controller.signal.aborted) {
        if (performerRevision.current === null || error instanceof ApiError && error.status === 409) {
          performerRevision.current = null; setReady(false);
        }
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
  }, [draft, loading, auth.status, auth.user?.id, router]);

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
