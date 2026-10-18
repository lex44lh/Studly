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
