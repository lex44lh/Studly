export type DataMode = "demo" | "live";

// Explicit selection only. Missing configuration always means live, including production.
export function resolveDataMode(value?: string): DataMode {
  // Compatibility with the already documented Django deployment environment.
  // This alias always selects real API data; it never enables a demo fallback.
  if (value === undefined || value === "" || value === "live" || value === "api") return "live";
  if (value === "demo") return "demo";
  throw new Error("NEXT_PUBLIC_STUDLY_DATA_MODE must be demo or live (legacy api means live)");
}
export const dataMode = resolveDataMode(process.env.NEXT_PUBLIC_STUDLY_DATA_MODE);
export const demoMode = dataMode === "demo";

// Build flag for the isolated rollout. The Django capability is also checked at runtime.
export const emailAuthUiEnabled = !demoMode && process.env.NEXT_PUBLIC_STUDLY_EMAIL_AUTH_UI === "1";
// The deployment routes /register/roles to the Django registration form.
export const telegramRegistrationEnabled = !demoMode && process.env.NEXT_PUBLIC_STUDLY_TELEGRAM_REGISTRATION === "1";
