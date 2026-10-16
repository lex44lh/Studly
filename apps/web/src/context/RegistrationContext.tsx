"use client";

import { createContext, useContext, useEffect, useReducer, type Dispatch, type ReactNode } from "react";
import Script from "next/script";
import { registrationClient } from "@/lib/api/registration";
import { createDraftState, draftReducer, type DraftAction } from "@/lib/registration/draft";
import { getTelegramProfilePrefill } from "@/lib/telegram/profile-prefill";
import type { RegistrationClient, RegistrationDraft } from "@/types/registration";

const RegistrationContext = createContext<{
  draft: RegistrationDraft;
  dispatch: Dispatch<DraftAction>;
  client: RegistrationClient;
} | null>(null);

export function RegistrationProvider({ children, client = registrationClient }: {
  children: ReactNode;
  client?: RegistrationClient;
}) {
  const [state, dispatch] = useReducer(draftReducer, undefined, createDraftState);
  const avatarUrl = state.draft.profile.avatarUrl;
  useEffect(() => () => {
    if (avatarUrl.startsWith("blob:")) URL.revokeObjectURL(avatarUrl);
  }, [avatarUrl]);

  return (
    <RegistrationContext.Provider value={{ draft: state.draft, dispatch, client }}>
      <Script src="https://telegram.org/js/telegram-web-app.js?64" strategy="afterInteractive"
        onReady={() => dispatch({ type: "prefill", data: getTelegramProfilePrefill() })} />
      {children}
    </RegistrationContext.Provider>
  );
}

export function useRegistration() {
  const context = useContext(RegistrationContext);
  if (!context) throw new Error("RegistrationProvider is required");
  return context;
}
