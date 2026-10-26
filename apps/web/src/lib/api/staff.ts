import { ApiError, apiMutation, apiRequest } from "./client";
import { readModeration, readExample, type PerformerModeration, type PortfolioExample } from "./account";
import { readCase, readMessage, type SecurityCase, type Message } from "./commerce";
import { readOwnService, readServicePage, type OwnService, type Page } from "./services";

export const staffResources = ["users", "performers", "services", "orders", "events", "security-cases"] as const;
export type StaffResource = typeof staffResources[number];
export type StaffSession = { id: number; display_name: string; resources: StaffResource[]; unavailable: string[] };
export type StaffUser = { id: number; display_name: string; is_active: boolean; roles: ("customer" | "performer")[] };
export type StaffPerformer = PerformerModeration & { display_name: string; description: string; examples: PortfolioExample[] };
export type StaffOrder = { id: number; title: string; description: string; included: string[]; duration_days: number;
  buyer: { id: number; name: string }; performer: { id: number; name: string }; price_amount: string; currency: string;
  buyer_fee_percent: string; buyer_fee_amount: string; total_amount: string; status: string; created_at: string };
export type StaffEvent = { id: number; actor_id: number | null; operation: string; target: string; details: Record<string, unknown>; created_at: string };
export type StaffRows = { users: StaffUser; performers: StaffPerformer; services: OwnService; orders: StaffOrder; events: StaffEvent; "security-cases": SecurityCase };
export type StaffRow = StaffRows[StaffResource];
export type StaffCase = SecurityCase & { message: Message };
export type StaffDecision = "approved" | "rejected" | "changes";
type Version = { revision: number; request_key: string };
const positive = (value: unknown) => Number.isSafeInteger(value) && Number(value) > 0;
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(x => typeof x === "string");
function invalid(): never { throw new ApiError(502, null); }
function numberId(id: number) { if (!positive(id)) throw new ApiError(404, null); return id; }
export function readStaffSession(value: StaffSession): StaffSession {
  if (!value || !positive(value.id) || typeof value.display_name !== "string" || !Array.isArray(value.resources) ||
      value.resources.some(x => !staffResources.includes(x)) || new Set(value.resources).size !== value.resources.length || !strings(value.unavailable)) invalid();
  return value;
}
export function readStaffRow<R extends StaffResource>(resource: R, value: StaffRows[R]): StaffRows[R] {
  if (!value) invalid();
  switch (resource) {
    case "users": {
      const row = value as StaffUser;
      if (!positive(row.id) || typeof row.display_name !== "string" || typeof row.is_active !== "boolean" ||
          !Array.isArray(row.roles) || row.roles.some(x => !["customer", "performer"].includes(x))) invalid(); break;
    }
    case "performers": {
      const row = value as StaffPerformer; readModeration(row);
      if (typeof row.display_name !== "string" || typeof row.description !== "string" || !Array.isArray(row.examples)) invalid();
      row.examples.forEach(readExample); break;
    }
    case "services": readOwnService(value as OwnService); break;
    case "security-cases": readCase(value as SecurityCase); break;
    case "orders": {
      const row = value as StaffOrder;
      if (!positive(row.id) || typeof row.title !== "string" || typeof row.description !== "string" || !strings(row.included) ||
          !positive(row.duration_days) || !row.buyer || !positive(row.buyer.id) || typeof row.buyer.name !== "string" ||
          !row.performer || !positive(row.performer.id) || typeof row.performer.name !== "string" || row.currency !== "RUB" ||
          ![row.price_amount, row.buyer_fee_percent, row.buyer_fee_amount, row.total_amount].every(x => typeof x === "string" && /^\d+\.\d{2}$/.test(x)) ||
          !["pending_acceptance", "awaiting_payment", "cancelled", "declined"].includes(row.status) || typeof row.created_at !== "string") invalid(); break;
    }
    case "events": {
      const row = value as StaffEvent;
      if (!positive(row.id) || (row.actor_id !== null && !positive(row.actor_id)) || typeof row.operation !== "string" ||
          typeof row.target !== "string" || !row.details || typeof row.details !== "object" || Array.isArray(row.details) || typeof row.created_at !== "string") invalid(); break;
    }
  }
  return value;
}
export const staffClient = {
  async me(signal?: AbortSignal) { return readStaffSession(await apiRequest<StaffSession>("staff/me/", { signal })); },
  async list<R extends StaffResource>(resource: R, query = "", signal?: AbortSignal): Promise<Page<StaffRows[R]>> {
    return readServicePage(await apiRequest<Page<StaffRows[R]>>(`staff/${resource}/${query ? `?${query}` : ""}`, { signal }), `staff/${resource}/`, 1, value => readStaffRow(resource, value));
  },
  async detail<R extends Exclude<StaffResource, "security-cases">>(resource: R, id: number, signal?: AbortSignal): Promise<StaffRows[R]> {
    const value = readStaffRow(resource, await apiRequest<StaffRows[R]>(`staff/${resource}/${numberId(id)}/`, { signal }));
    if (("user_id" in value ? value.user_id : value.id) !== id) invalid();
    return value;
  },
  async caseContent(id: number, purpose: string, signal?: AbortSignal): Promise<StaffCase> {
    if (!purpose.trim() || purpose.trim().length > 500) throw new ApiError(400, null);
    const value = await apiRequest<StaffCase>(`staff/security-cases/${numberId(id)}/?${new URLSearchParams({ purpose: purpose.trim() })}`, { signal });
    readCase(value); readMessage(value.message);
    if (value.id !== id || value.message.id !== value.message_id || value.message.conversation_id !== value.conversation_id) invalid();
    return value;
  },
  async decideProfile(id: number, input: Version & { decision: StaffDecision; reason: string }, signal?: AbortSignal) {
    return readModeration(await apiMutation<PerformerModeration>(`staff/performers/${numberId(id)}/decision/`, "POST", input, signal));
  },
  async decideService(id: number, input: Version & { decision: StaffDecision; reason: string }, signal?: AbortSignal) {
    return readOwnService(await apiMutation<OwnService>(`staff/services/${numberId(id)}/decision/`, "POST", input, signal));
  },
  async decideCase(id: number, input: Version & { decision: "release" | "keep"; reason: string }, signal?: AbortSignal) {
    return readCase(await apiMutation<SecurityCase>(`staff/security-cases/${numberId(id)}/`, "POST", input, signal));
  },
};
