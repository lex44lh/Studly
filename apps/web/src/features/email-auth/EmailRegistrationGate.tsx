"use client";

import type { ReactNode } from "react";
import { authClient } from "@/lib/api/auth";
import { LiveAccess, LiveState, useLiveResource } from "@/features/live/shared";
import { RegistrationProvider } from "@/context/RegistrationContext";

export function EmailRegistrationGate({ children, closed }: { children: ReactNode; closed: ReactNode }) {
  const options = useLiveResource("email-registration-options", authClient.options);
  if (options.loading || options.error) return <LiveState loading={options.loading} error={options.error} retry={options.reload} />;
  if (options.data?.email_registration !== true) return closed;
  return <LiveAccess><RegistrationProvider>{children}</RegistrationProvider></LiveAccess>;
}
