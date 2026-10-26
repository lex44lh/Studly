import { ApiError, apiMutation, apiRequest, pagePath } from "./client";

export type QuoteExtra = { id: string; title: string; price_amount: string; extra_days: number };
export type MoneySnapshot = {
  title: string; description: string; included: string[]; duration_days: number; currency: "RUB";
  base_price_amount: string; selected_extras: QuoteExtra[]; price_amount: string;
  buyer_fee_percent: string; buyer_fee_amount: string; total_amount: string; tariff_code: string;
};
export type QuoteV2 = MoneySnapshot & { quote_id: string; service_id: number; service_revision: number; performer_id: number; extras_amount: string };
export type OrderAction = "accept" | "cancel" | "decline";
export type OrderV2 = MoneySnapshot & {
  id: number; service_id: number; service_revision: number; revision: number; request_key: string;
  buyer: { id: number; name: string }; performer: { id: number; name: string };
  quote_id: string | null; available_actions: OrderAction[]; payment_status: "unpaid";
  status: "pending_acceptance" | "awaiting_payment" | "cancelled" | "declined";
  created_at: string; accepted_at: string | null; closed_at: string | null;
};
export type OrderEvent = { id: number; actor_id: number; action: string; revision: number; created_at: string };
export type Conversation = { id: string; kind: "order" | "discussion"; order_id: number | null; service_id: number; title: string; participant_ids: number[]; created_at: string };
export type Message = { id: number; sequence: number; conversation_id: string; sender_id: number; client_message_id: string; text: string;
  status: "stored" | "held"; categories: string[]; rules_version: string; warning: string | null; security_case_id: number | null; created_at: string };
export type SecurityCase = { id: number; message_id: number; conversation_id: string; revision: number; categories: string[]; rules_version: string;
  appealed: boolean; appeal_reason: string; decision: "release" | "keep" | null; decision_reason: string };
export type Page<T> = { count: number; next: string | null; previous: string | null; results: T[] };
export type CursorPage<T> = { next: string | null; previous: string | null; results: T[] };

const positive = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const uuid = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(x => typeof x === "string");
const decimal = (value: unknown) => typeof value === "string" && /^\d+\.\d{2}$/.test(value);
const timestamp = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value));
function invalid(): never { throw new ApiError(502, null); }
function numberId(id: string | number): string { if (!/^\d+$/.test(String(id)) || !positive(Number(id))) throw new ApiError(404, null); return String(id); }
function uuidId(id: string): string { if (!uuid(id)) throw new ApiError(404, null); return id; }
function readMoney<T extends MoneySnapshot>(value: T): T {
  if (!value || typeof value.title !== "string" || typeof value.description !== "string" || !strings(value.included) || !positive(value.duration_days) || value.currency !== "RUB" ||
    ![value.base_price_amount, value.price_amount, value.buyer_fee_percent, value.buyer_fee_amount, value.total_amount].every(decimal) ||
    typeof value.tariff_code !== "string" || !value.tariff_code || !Array.isArray(value.selected_extras)) invalid();
  value.selected_extras.forEach(extra => { if (!extra || !uuid(extra.id) || typeof extra.title !== "string" || !decimal(extra.price_amount) || !Number.isSafeInteger(extra.extra_days) || extra.extra_days < 0) invalid(); });
  return value;
}
export function readQuote(value: QuoteV2): QuoteV2 {
  readMoney(value);
  if (!uuid(value.quote_id) || !positive(value.service_id) || !positive(value.service_revision) || !positive(value.performer_id) || !decimal(value.extras_amount)) invalid();
  return value;
}
export function readOrder(value: OrderV2): OrderV2 {
  readMoney(value);
  if (!positive(value.id) || !positive(value.service_id) || !positive(value.service_revision) || !positive(value.revision) || !uuid(value.request_key) ||
    !value.buyer || !positive(value.buyer.id) || typeof value.buyer.name !== "string" || !value.performer || !positive(value.performer.id) || typeof value.performer.name !== "string" ||
    (value.quote_id !== null && !uuid(value.quote_id)) || !Array.isArray(value.available_actions) || value.available_actions.some(x => !["accept", "cancel", "decline"].includes(x)) ||
    value.payment_status !== "unpaid" || !["pending_acceptance", "awaiting_payment", "cancelled", "declined"].includes(value.status) || !timestamp(value.created_at) ||
    (value.accepted_at !== null && !timestamp(value.accepted_at)) || (value.closed_at !== null && !timestamp(value.closed_at))) invalid();
  return value;
}
export function readConversation(value: Conversation): Conversation {
  if (!value || !uuid(value.id) || !["order", "discussion"].includes(value.kind) || !positive(value.service_id) || typeof value.title !== "string" ||
    !Array.isArray(value.participant_ids) || value.participant_ids.length !== 2 || !value.participant_ids.every(positive) || value.participant_ids[0] === value.participant_ids[1] ||
    (value.kind === "order" ? !positive(value.order_id) : value.order_id !== null) || !timestamp(value.created_at)) invalid();
  return value;
}
export function readMessage(value: Message): Message {
  if (!value || !positive(value.id) || !positive(value.sequence) || !uuid(value.conversation_id) || !positive(value.sender_id) || !uuid(value.client_message_id) || typeof value.text !== "string" ||
    !["stored", "held"].includes(value.status) || !strings(value.categories) || typeof value.rules_version !== "string" || !timestamp(value.created_at) ||
    (value.status === "held" ? !positive(value.security_case_id) || typeof value.warning !== "string" : value.security_case_id !== null || value.warning !== null)) invalid();
  return value;
}
export function readCase(value: SecurityCase): SecurityCase {
  if (!value || !positive(value.id) || !positive(value.message_id) || !uuid(value.conversation_id) || !positive(value.revision) || !strings(value.categories) ||
    typeof value.rules_version !== "string" || typeof value.appealed !== "boolean" || typeof value.appeal_reason !== "string" || typeof value.decision_reason !== "string" ||
    ![null, "release", "keep"].includes(value.decision)) invalid();
  return value;
}
function readEvent(value: OrderEvent): OrderEvent {
  if (!value || !positive(value.id) || !positive(value.actor_id) || typeof value.action !== "string" || !positive(value.revision) || !timestamp(value.created_at)) invalid();
  return value;
}
function readPage<T>(value: CursorPage<T>, resource: string, read: (value: T) => T, version: 1 | 2): CursorPage<T> {
  if (!value || !Array.isArray(value.results) || (value.next !== null && typeof value.next !== "string") || (value.previous !== null && typeof value.previous !== "string")) invalid();
  if (value.next) pagePath(value.next, resource, version);
  if (value.previous) pagePath(value.previous, resource, version);
  value.results.forEach(read); return value;
}
async function page<T>(resource: string, read: (value: T) => T, next: string | undefined, signal: AbortSignal | undefined, version: 1 | 2, query = ""): Promise<Page<T>> {
  const result = await apiRequest<Page<T>>(next ? pagePath(next, resource, version) : `${resource}${query}`, { signal, version });
  readPage(result, resource, read, version);
  if (!Number.isSafeInteger(result.count) || result.count < 0) invalid();
  return result;
}

// A released held message keeps its ID but receives a new visibility sequence.
// Reject foreign conversations and held content for another sender even if a bad response leaks it.
export function mergeMessages(existing: Message[], incoming: Message[], conversationId: string, viewerId: number): Message[] {
  const rows = new Map<number, Message>();
  for (const value of [...existing, ...incoming]) {
    readMessage(value);
    if (value.conversation_id !== conversationId || (value.status === "held" && value.sender_id !== viewerId)) continue;
    if (!rows.has(value.id) || rows.get(value.id)!.sequence <= value.sequence) rows.set(value.id, value);
  }
  return [...rows.values()].sort((a, b) => a.sequence - b.sequence || a.id - b.id);
}

export const commerceClient = {
  async quote(serviceId: string | number, extras: string[], signal?: AbortSignal) {
    const value = readQuote(await apiMutation<QuoteV2>("quotes/", "POST", { service_id: Number(numberId(serviceId)), extra_ids: extras }, signal, 2));
    if (value.service_id !== Number(serviceId) || value.selected_extras.map(x => x.id.toLowerCase()).sort().join(",") !== extras.map(x => x.toLowerCase()).sort().join(",")) invalid();
    return value;
  },
  async quoteDetail(id: string, signal?: AbortSignal) {
    const value = readQuote(await apiRequest<QuoteV2>(`quotes/${uuidId(id)}/`, { signal, version: 2 }));
    if (value.quote_id !== id) invalid(); return value;
  },
  async purchase(quoteId: string, requestKey: string, signal?: AbortSignal) {
    const value = readOrder(await apiMutation<OrderV2>("orders/", "POST", { quote_id: uuidId(quoteId), request_key: requestKey }, signal, 2));
    if (value.quote_id !== quoteId || value.request_key !== requestKey) invalid(); return value;
  },
  orders(role: "customer" | "performer" | "all", next?: string, signal?: AbortSignal) { return page("orders/", readOrder, next, signal, 2, role === "all" ? "" : `?role=${role}`); },
  async order(id: string | number, signal?: AbortSignal) {
    const value = readOrder(await apiRequest<OrderV2>(`orders/${numberId(id)}/`, { signal, version: 2 }));
    if (value.id !== Number(id)) invalid(); return value;
  },
  async orderAction(id: number, action: OrderAction, revision: number, requestKey: string, signal?: AbortSignal) {
    const value = readOrder(await apiMutation<OrderV2>(`orders/${numberId(id)}/${action}/`, "POST", { revision, request_key: requestKey }, signal, 2));
    if (value.id !== id) invalid(); return value;
  },
  events(id: number, next?: string, signal?: AbortSignal) { return page(`orders/${numberId(id)}/events/`, readEvent, next, signal, 1); },
  conversations(next?: string, signal?: AbortSignal) { return page("conversations/", readConversation, next, signal, 1); },
  async conversation(id: string, signal?: AbortSignal) {
    const value = readConversation(await apiRequest<Conversation>(`conversations/${uuidId(id)}/`, { signal }));
    if (value.id !== id) invalid(); return value;
  },
  async orderConversation(id: number, signal?: AbortSignal) {
    const value = readConversation(await apiRequest<Conversation>(`orders/${numberId(id)}/conversation/`, { signal }));
    if (value.kind !== "order" || value.order_id !== id) invalid(); return value;
  },
  async discussion(serviceId: string | number, requestKey: string, signal?: AbortSignal) {
    const value = readConversation(await apiMutation<Conversation>("discussions/", "POST", { service_id: Number(numberId(serviceId)), request_key: requestKey }, signal));
    if (value.kind !== "discussion" || value.service_id !== Number(serviceId)) invalid(); return value;
  },
  async messages(id: string, next?: string, signal?: AbortSignal) {
    const resource = `conversations/${uuidId(id)}/messages/`;
    const value = readPage(await apiRequest<CursorPage<Message>>(next ? pagePath(next, resource) : resource, { signal }), resource, readMessage, 1);
    if (value.results.some(x => x.conversation_id !== id)) invalid(); return value;
  },
  async send(id: string, clientMessageId: string, text: string, signal?: AbortSignal) {
    const value = readMessage(await apiMutation<Message>(`conversations/${uuidId(id)}/messages/`, "POST", { client_message_id: clientMessageId, text }, signal));
    if (value.conversation_id !== id || value.client_message_id !== clientMessageId) invalid(); return value;
  },
  async securityCase(id: number, signal?: AbortSignal) {
    const value = readCase(await apiRequest<SecurityCase>(`security-cases/${numberId(id)}/appeal/`, { signal }));
    if (value.id !== id) invalid(); return value;
  },
  async appeal(id: number, revision: number, requestKey: string, reason: string, signal?: AbortSignal) {
    const value = readCase(await apiMutation<SecurityCase>(`security-cases/${numberId(id)}/appeal/`, "POST", { revision, request_key: requestKey, reason }, signal));
    if (value.id !== id) invalid(); return value;
  },
};
