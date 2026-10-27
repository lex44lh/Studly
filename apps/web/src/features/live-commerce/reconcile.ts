import { ApiError } from "@/lib/api/client";
import { commerceClient, mergeMessages, type Message, type OrderV2 } from "@/lib/api/commerce";
import type { PurchaseIntent } from "./protocol";

export async function currentOrder(id: number, viewer: number, signal: AbortSignal): Promise<OrderV2> {
  const value = await commerceClient.order(id, signal);
  if (value.id !== id || (value.buyer.id !== viewer && value.performer.id !== viewer)) throw new ApiError(502, null);
  return value;
}
export async function findPurchaseOrder(viewer: number, serviceId: string, intent: PurchaseIntent, signal: AbortSignal): Promise<OrderV2 | null> {
  const seen = new Set<string>(); let next: string | undefined;
  do {
    const cursor = next ?? "first"; if (seen.has(cursor)) throw new ApiError(502, null); seen.add(cursor);
    const page = await commerceClient.orders("customer", next, signal);
    if (page.results.some(value => value.buyer.id !== viewer)) throw new ApiError(502, null);
    const match = page.results.find(value => value.quote_id === intent.quoteId && value.request_key === intent.requestKey);
    if (match) {
      const current = await currentOrder(match.id, viewer, signal);
      if (current.buyer.id !== viewer || current.service_id !== Number(serviceId) || current.quote_id !== intent.quoteId || current.request_key !== intent.requestKey) throw new ApiError(502, null);
      return current;
    }
    next = page.next ?? undefined;
  } while (next);
  return null;
}

// Receipts are immutable acknowledgements, not current message snapshots. A
// released message can be beyond the first cursor page with the same ID.
export async function currentMessages(id: string, viewer: number, receipt: Message, signal: AbortSignal): Promise<Message[]> {
  const seen = new Set<string>(); let next: string | undefined; let rows: Message[] = [];
  do {
    const cursor = next ?? "first"; if (seen.has(cursor)) throw new ApiError(502, null); seen.add(cursor);
    const page = await commerceClient.messages(id, next, signal);
    rows = mergeMessages(rows, page.results, id, viewer);
    next = page.next ?? undefined;
  } while (next);
  if (!rows.some(value => value.id === receipt.id && value.client_message_id === receipt.client_message_id && value.sender_id === viewer)) throw new ApiError(502, null);
  return rows;
}
