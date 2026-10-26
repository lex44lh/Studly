import type { RegistrationResponse } from "@/types/registration-api";
import type { RegistrationRole } from "@/types/registration";
import { ApiError, apiMutation, apiRequest, pagePath } from "./client";
import { readRegistration, registrationClient } from "./registration";

export type AccountCapabilities = {
  customer: boolean; performer: boolean; create_order: boolean; create_service: boolean;
  django_admin: boolean; moderate_services: boolean; moderate_performers: boolean;
};
export type LiveAccount = { id: number; registration: RegistrationResponse; capabilities: AccountCapabilities };
export type PerformerModeration = {
  user_id: number; revision: number; status: "draft" | "pending" | "approved" | "rejected" | "changes";
  reason: string; submitted_at: string | null; ready_to_submit: boolean; missing_fields: string[]; approved: boolean;
};
export type Cabinet = {
  role: RegistrationRole; account_id: number; registration: RegistrationResponse; capabilities: AccountCapabilities;
  orders: { count: number; by_status: Record<string, number>; url: string };
  services: Record<string, number> | null; moderation: PerformerModeration | null;
  statistics: { completed_orders: number | null; rating: number | null; review_count: number | null }; unavailable: string[];
};
export type PortfolioExample = {
  id: string; title: string; kind: "link" | "file"; url: string | null; content_url: string | null;
  content_type: string | null; size: number; created_at: string;
};
export type PortfolioPage = { count: number; next: string | null; previous: string | null; results: PortfolioExample[] };
export type AccountVersion = { revision: number; request_key: string };
export type PortfolioResult = { example: PortfolioExample; moderation: PerformerModeration };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const integer = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0;
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === "string");
const counts = (value: unknown) => !!value && typeof value === "object" && !Array.isArray(value) && Object.values(value).every(integer);
function invalid(): never { throw new ApiError(502, null); }
function capabilities(value: AccountCapabilities) {
  if (!value || !["customer", "performer", "create_order", "create_service", "django_admin", "moderate_services", "moderate_performers"]
    .every(key => typeof value[key as keyof AccountCapabilities] === "boolean")) invalid();
  return value;
}
export function readAccount(value: LiveAccount): LiveAccount {
  if (!value || !integer(value.id) || value.id <= 0) invalid();
  readRegistration(value.registration); capabilities(value.capabilities); return value;
}
export function readModeration(value: PerformerModeration): PerformerModeration {
  if (!value || !integer(value.user_id) || value.user_id <= 0 || !integer(value.revision) || value.revision < 1 ||
      !["draft", "pending", "approved", "rejected", "changes"].includes(value.status) || typeof value.reason !== "string" ||
      (value.submitted_at !== null && typeof value.submitted_at !== "string") || typeof value.ready_to_submit !== "boolean" ||
      !strings(value.missing_fields) || typeof value.approved !== "boolean") invalid();
  return value;
}
export function safePortfolioUrl(value: string): string {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || value.length > 2000) invalid();
    return url.href;
  } catch { return invalid(); }
}
export function portfolioContentPath(id: string, path: string): string {
  if (!uuid.test(id) || path !== `/api/v1/portfolio/${id}/content/`) invalid();
  return path;
}
export function readExample(value: PortfolioExample): PortfolioExample {
  if (!value || typeof value.id !== "string" || !uuid.test(value.id) || typeof value.title !== "string" ||
      !["link", "file"].includes(value.kind) || !integer(value.size) || typeof value.created_at !== "string") invalid();
  if (value.kind === "link") {
    if (typeof value.url !== "string" || value.content_url !== null || value.content_type !== null || value.size !== 0) invalid();
    safePortfolioUrl(value.url);
  } else {
    if (value.url !== null || typeof value.content_url !== "string" || !["image/png", "application/pdf"].includes(value.content_type ?? "")) invalid();
    portfolioContentPath(value.id, value.content_url);
  }
  return value;
}
export function readCabinet(value: Cabinet, role: RegistrationRole): Cabinet {
  if (!value || value.role !== role || !integer(value.account_id) || value.account_id <= 0 || !value.orders ||
      !integer(value.orders.count) || !counts(value.orders.by_status) || value.orders.url !== `/api/v1/orders/?role=${role}` ||
      (value.services !== null && !counts(value.services)) || !value.statistics ||
      !Object.values(value.statistics).every(item => item === null || (typeof item === "number" && Number.isFinite(item) && item >= 0)) ||
      !strings(value.unavailable)) invalid();
  readRegistration(value.registration); capabilities(value.capabilities);
  if (value.moderation !== null) readModeration(value.moderation);
  return value;
}
function readResult(value: PortfolioResult): PortfolioResult {
  if (!value) invalid(); readExample(value.example); readModeration(value.moderation); return value;
}
function exampleId(id: string) { if (!uuid.test(id)) throw new ApiError(404, null); return id; }
export const accountClient = {
  async account(signal?: AbortSignal) { return readAccount(await apiRequest<LiveAccount>("account/", { signal })); },
  async snapshot(signal?: AbortSignal): Promise<{ account: LiveAccount; moderation: PerformerModeration }> {
    const before = await accountClient.moderation(signal);
    const account = await accountClient.account(signal);
    const after = await accountClient.moderation(signal);
    if (before.revision !== after.revision || before.user_id !== after.user_id || account.id !== after.user_id) {
      throw new ApiError(409, { code: "profile_snapshot_changed" });
    }
    return { account, moderation: after };
  },
  async registrationSnapshot(signal?: AbortSignal): Promise<{ registration: RegistrationResponse; moderation: PerformerModeration }> {
    const before = await accountClient.moderation(signal);
    const registration = await registrationClient.loadDraft(signal);
    const after = await accountClient.moderation(signal);
    if (before.revision !== after.revision || before.user_id !== after.user_id) {
      throw new ApiError(409, { code: "profile_snapshot_changed" });
    }
    return { registration, moderation: after };
  },
  async cabinet(role: RegistrationRole, signal?: AbortSignal) {
    return readCabinet(await apiRequest<Cabinet>(`cabinet/?role=${role}`, { signal }), role);
  },
  async moderation(signal?: AbortSignal) { return readModeration(await apiRequest<PerformerModeration>("performer/moderation/", { signal })); },
  async submit(version: AccountVersion, signal?: AbortSignal) {
    return readModeration(await apiMutation<PerformerModeration>("performer/moderation/", "POST", version, signal));
  },
  async portfolio(signal?: AbortSignal, next?: string): Promise<PortfolioPage> {
    const value = await apiRequest<PortfolioPage>(next ? pagePath(next, "portfolio/") : "portfolio/", { signal });
    if (!value || !integer(value.count) || !Array.isArray(value.results) || (value.next !== null && typeof value.next !== "string") ||
        (value.previous !== null && typeof value.previous !== "string")) invalid();
    if (value.next) pagePath(value.next, "portfolio/");
    if (value.previous) pagePath(value.previous, "portfolio/");
    value.results.forEach(readExample); return value;
  },
  async addExample(input: { title: string; url: string } | { title: string; file: File }, version: AccountVersion, signal?: AbortSignal) {
    let body: unknown = { ...version, ...input };
    if ("file" in input) {
      const form = new FormData();
      form.append("revision", String(version.revision)); form.append("request_key", version.request_key);
      form.append("title", input.title); form.append("file", input.file); body = form;
    }
    return readResult(await apiMutation<PortfolioResult>("portfolio/", "POST", body, signal));
  },
  async editExample(id: string, patch: { title?: string; url?: string }, version: AccountVersion, signal?: AbortSignal) {
    return readResult(await apiMutation<PortfolioResult>(`portfolio/${exampleId(id)}/`, "PATCH", { ...version, ...patch }, signal));
  },
  async deleteExample(id: string, version: AccountVersion, signal?: AbortSignal) {
    const value = await apiMutation<{ moderation: PerformerModeration }>(`portfolio/${exampleId(id)}/`, "DELETE", version, signal);
    if (!value) invalid(); readModeration(value.moderation); return value;
  },
};
