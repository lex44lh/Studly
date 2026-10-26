import { ApiError } from "@/lib/api/client";

export type PurchaseIntent = { quoteId: string; requestKey: string; attempted: boolean };
export type OrderRole = "all" | "customer" | "performer";
export function initialOrderRole(value: string | null): OrderRole { return value === "customer" || value === "performer" ? value : "all"; }
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

// Only opaque intent IDs are kept. No message text, credentials, or quote amounts.
export function purchaseStorageKey(userId: number, serviceId: string, extraIds: string[]) {
  return `studly-live-purchase:${userId}:${serviceId}:${[...extraIds].sort().join(",")}`;
}
export function readPurchaseIntent(key: string): PurchaseIntent | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? "null");
    return value && UUID.test(value.quoteId) && UUID.test(value.requestKey) && typeof value.attempted === "boolean" ? value : null;
  } catch { return null; }
}
export function savePurchaseIntent(key: string, value: PurchaseIntent | null) {
  try { if (value) sessionStorage.setItem(key, JSON.stringify(value)); else sessionStorage.removeItem(key); return true; }
  catch { return false; }
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
