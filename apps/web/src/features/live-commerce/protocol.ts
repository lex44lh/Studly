import { ApiError } from "@/lib/api/client";

export type PurchaseIntent = { quoteId: string; requestKey: string; attempted: boolean };
export type PurchaseDiscovery = { intent: PurchaseIntent | null; blocked: boolean; error: string };
export type OrderRole = "all" | "customer" | "performer";
export function initialOrderRole(value: string | null): OrderRole { return value === "customer" || value === "performer" ? value : "all"; }
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

// Only opaque intent IDs are kept. No message text, credentials, or quote amounts.
export function purchaseStorageKey(userId: number, serviceId: string, extraIds: string[]) {
  return `studly-live-purchase:${userId}:${serviceId}:${[...extraIds].sort().join(",")}`;
}
export function pendingPurchaseStorageKey(userId: number, serviceId: string) { return `studly-live-purchase:v2:${userId}:${serviceId}`; }
function parseIntent(raw: string | null): PurchaseIntent | null {
  try {
    const value = JSON.parse(raw ?? "null");
    return value && UUID.test(value.quoteId) && UUID.test(value.requestKey) && typeof value.attempted === "boolean"
      ? { quoteId: value.quoteId, requestKey: value.requestKey, attempted: value.attempted } : null;
  } catch { return null; }
}
export function readPurchaseIntent(key: string): PurchaseIntent | null {
  try { return parseIntent(sessionStorage.getItem(key)); } catch { return null; }
}
export function savePurchaseIntent(key: string, value: PurchaseIntent | null) {
  try { if (value) sessionStorage.setItem(key, JSON.stringify(value)); else sessionStorage.removeItem(key); return true; }
  catch { return false; }
}
// Discover before reading the current (initially empty) extra selection. Migrate
// older per-extra slots, but never silently choose between unresolved purchases.
export function discoverPurchaseIntent(userId: number, serviceId: string, selectedIds: string[] = []): PurchaseDiscovery {
  const error = "Не удалось безопасно восстановить предыдущее намерение покупки. Новое оформление заблокировано. Проверьте свои заказы и повторите чтение сохранённого расчёта.";
  try {
    const canonical = pendingPurchaseStorageKey(userId, serviceId);
    const keys = new Set([canonical, purchaseStorageKey(userId, serviceId, selectedIds)]);
    const prefix = `studly-live-purchase:${userId}:${serviceId}:`;
    for (let index = 0; index < sessionStorage.length; index++) {
      const key = sessionStorage.key(index); if (key?.startsWith(prefix)) keys.add(key);
    }
    const values: PurchaseIntent[] = [];
    for (const key of keys) {
      const raw = sessionStorage.getItem(key); if (raw === null) continue;
      const value = parseIntent(raw); if (!value) return { intent: null, blocked: true, error };
      values.push(value);
    }
    const attempted = values.filter(value => value.attempted);
    const distinct = new Set(attempted.map(value => `${value.quoteId}:${value.requestKey}`));
    if (distinct.size > 1) return { intent: null, blocked: true, error };
    const intent = attempted[0] ?? values[0] ?? null;
    if (intent && !savePurchaseIntent(canonical, intent)) return { intent, blocked: true, error };
    return { intent, blocked: false, error: "" };
  } catch { return { intent: null, blocked: true, error }; }
}
// Clear only the reconciled intent. Another unresolved key is never discarded.
export function clearPurchaseIntent(userId: number, serviceId: string, intent: PurchaseIntent) {
  try {
    const keys = [pendingPurchaseStorageKey(userId, serviceId)];
    const prefix = `studly-live-purchase:${userId}:${serviceId}:`;
    for (let index = 0; index < sessionStorage.length; index++) {
      const key = sessionStorage.key(index); if (key?.startsWith(prefix)) keys.push(key);
    }
    for (const key of keys) {
      const saved = readPurchaseIntent(key);
      if (saved?.quoteId === intent.quoteId && saved.requestKey === intent.requestKey) sessionStorage.removeItem(key);
    }
    return true;
  } catch { return false; }
}
export function outcomeUnknown(error: unknown): boolean {
  return !(error instanceof ApiError) || error.status === 0 || error.status >= 500;
}

// A changed UI role never changes the actual participant identity.
export function allowedOrderActions(order: { buyer: { id: number }; performer: { id: number }; status: string; available_actions: string[] }, userId: number) {
  return order.available_actions.filter(action =>
    action === "cancel" ? order.buyer.id === userId && ["pending_acceptance", "awaiting_payment"].includes(order.status) :
    ["accept", "decline"].includes(action) && order.performer.id === userId && order.status === "pending_acceptance");
}
