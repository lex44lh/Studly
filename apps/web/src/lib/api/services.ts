import { ApiError, apiMutation, apiRequest, pagePath } from "./client";
import { readService, type Service, type ServicePage } from "./catalog";

export type ServiceExtra = { id: string; title: string; price_amount: string; extra_days: number };
export type ServiceV2 = Service & { revision: number; category: string; extras: ServiceExtra[] };
export type OwnService = ServiceV2 & {
  status: "draft" | "pending" | "published" | "rejected" | "changes";
  reason: string;
  portfolio_example_ids: string[];
};
export type Page<T> = { count: number; next: string | null; previous: string | null; results: T[] };
export type VersionedServiceAction = { revision: number; request_key: string };
export type ServiceDraftInput = VersionedServiceAction & Partial<Pick<ServiceV2,
  "title" | "description" | "category" | "price_amount" | "duration_days" | "included" | "extras"
>> & { portfolio_example_ids?: string[] };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const amount = /^\d{1,8}\.\d{2}$/;
const invalid = () => { throw new ApiError(502, null); };
function idPath(id: string | number) {
  if (!/^[1-9]\d*$/.test(String(id))) throw new ApiError(404, null);
  return String(id);
}
export function readServiceV2(value: ServiceV2): ServiceV2 {
  readService(value);
  if (!Number.isSafeInteger(value.revision) || value.revision < 1 || !amount.test(value.price_amount) || value.duration_days > 32767 || typeof value.category !== "string" ||
    !Array.isArray(value.extras) || value.extras.length > 50) invalid();
  const ids = new Set<string>();
  for (const item of value.extras) {
    if (!item || typeof item.id !== "string" || !uuid.test(item.id) || ids.has(item.id) || typeof item.title !== "string" ||
      typeof item.price_amount !== "string" || !amount.test(item.price_amount) || !Number.isInteger(item.extra_days) || item.extra_days < 0 || item.extra_days > 32766) invalid();
    ids.add(item.id);
  }
  return value;
}
export function readOwnService(value: OwnService): OwnService {
  readServiceV2(value);
  if (!["draft", "pending", "published", "rejected", "changes"].includes(value.status) || typeof value.reason !== "string" ||
    !Array.isArray(value.portfolio_example_ids) || value.portfolio_example_ids.some(id => typeof id !== "string" || !uuid.test(id))) invalid();
  return value;
}
export function readServicePage<T>(value: Page<T>, resource: string, version: 1 | 2, read: (item: T) => T): Page<T> {
  if (!value || !Number.isSafeInteger(value.count) || value.count < 0 || !Array.isArray(value.results) ||
    (value.next !== null && typeof value.next !== "string") || (value.previous !== null && typeof value.previous !== "string")) invalid();
  if (value.next) pagePath(value.next, resource, version);
  if (value.previous) pagePath(value.previous, resource, version);
  value.results.forEach(read);
  return value;
}
export const servicesClient = {
  async list(query = "", signal?: AbortSignal) {
    return readServicePage(await apiRequest<Page<ServiceV2>>(`services/${query ? `?${query}` : ""}`, { signal, version: 2 }), "services/", 2, readServiceV2);
  },
  async detail(id: string | number, signal?: AbortSignal) {
    return readServiceV2(await apiRequest<ServiceV2>(`services/${idPath(id)}/`, { signal, version: 2 }));
  },
  async myList(query = "", signal?: AbortSignal) {
    return readServicePage(await apiRequest<Page<OwnService>>(`my/services/${query ? `?${query}` : ""}`, { signal, version: 2 }), "my/services/", 2, readOwnService);
  },
  async myDetail(id: string | number, signal?: AbortSignal) {
    return readOwnService(await apiRequest<OwnService>(`my/services/${idPath(id)}/`, { signal, version: 2 }));
  },
  async create(input: ServiceDraftInput, signal?: AbortSignal) {
    return readOwnService(await apiMutation<OwnService>("my/services/", "POST", input, signal, 2));
  },
  async patch(id: string | number, input: ServiceDraftInput, signal?: AbortSignal) {
    return readOwnService(await apiMutation<OwnService>(`my/services/${idPath(id)}/`, "PATCH", input, signal, 2));
  },
  async submit(id: string | number, input: VersionedServiceAction, signal?: AbortSignal) {
    return readOwnService(await apiMutation<OwnService>(`my/services/${idPath(id)}/submit/`, "POST", input, signal, 2));
  },
};

// Favorites use the v1 serializer. Read all pages before deriving membership;
// public catalog pagination is never filtered using a partial local ID list.
export const favoritesClient = {
  async list(query = "", signal?: AbortSignal): Promise<ServicePage> {
    return readServicePage(await apiRequest<ServicePage>(`favorites/${query ? `?${query}` : ""}`, { signal }), "favorites/", 1, readService);
  },
  async all(signal?: AbortSignal): Promise<Service[]> {
    const seen = new Set<string>();
    const results: Service[] = [];
    let query = "";
    do {
      if (seen.has(query)) invalid();
      seen.add(query);
      const page = await favoritesClient.list(query, signal);
      results.push(...page.results);
      if (!page.next) return results;
      query = pagePath(page.next, "favorites/").split("?")[1] ?? "";
    } while (!signal?.aborted);
    throw new DOMException("Aborted", "AbortError");
  },
  add: (id: number, signal?: AbortSignal) => apiMutation<void>(`favorites/${idPath(id)}/`, "PUT", {}, signal),
  remove: (id: number, signal?: AbortSignal) => apiMutation<void>(`favorites/${idPath(id)}/`, "DELETE", {}, signal),
};
