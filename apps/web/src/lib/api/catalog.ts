import { ApiError, apiRequest, pagePath } from "./client";
export type Service = {
  id: number; title: string; description: string; price_amount: string; currency: string; duration_days: number;
  performer: { id: number; name: string }; included: string[]; is_demo: boolean;
};
export type ServicePage = { count: number; next: string | null; previous: string | null; results: Service[] };
export type Performer = { id: number; name: string; about: string };
export type Quote = { service_id: number; service_revision: number; price_amount: string; currency: string; is_demo: boolean;
  buyer_fee_percent: string; buyer_fee_amount: string; total_amount: string };
export { demoMode } from "../data-mode";
export function money(amount: string, currency: string) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency }).format(Number(amount));
}
function readService(value: Service): Service {
  if (!value || !Number.isSafeInteger(value.id) || typeof value.title !== "string" || typeof value.description !== "string" ||
      !/^\d+\.\d{2}$/.test(value.price_amount) || value.currency !== "RUB" || !Number.isInteger(value.duration_days) ||
      !value.performer || !Number.isSafeInteger(value.performer.id) || typeof value.performer.name !== "string" ||
      typeof value.is_demo !== "boolean" || !Array.isArray(value.included) || value.included.some(item => typeof item !== "string")) throw new ApiError(502, null);
  return value;
}
export const catalogClient = {
  async list(query: string, signal?: AbortSignal): Promise<ServicePage> {
    const value = await apiRequest<ServicePage>(`services/${query ? `?${query}` : ""}`, { signal });
    if (!value || !Array.isArray(value.results) || !Number.isInteger(value.count) || value.count < 0 || (value.next !== null && typeof value.next !== "string") || (value.previous !== null && typeof value.previous !== "string")) throw new ApiError(502, null);
    if (value.next) pagePath(value.next, "services/");
    if (value.previous) pagePath(value.previous, "services/");
    value.results.forEach(readService); return value;
  },
  async service(id: string, signal?: AbortSignal) {
    if (!/^\d+$/.test(id)) throw new ApiError(404, null);
    return readService(await apiRequest<Service>(`services/${id}/`, { signal }));
  },
  async performer(id: string, signal?: AbortSignal) {
    if (!/^\d+$/.test(id)) throw new ApiError(404, null);
    const value = await apiRequest<Performer>(`performers/${id}/`, { signal });
    if (!value || !Number.isSafeInteger(value.id) || typeof value.name !== "string" || typeof value.about !== "string") throw new ApiError(502, null);
    return value;
  },
  async quote(id: string, signal?: AbortSignal) {
    const value = await apiRequest<Quote>(`services/${id}/quote/`, { signal });
    if (!value || value.service_id !== Number(id) || !Number.isSafeInteger(value.service_revision) || value.currency !== "RUB" ||
        typeof value.is_demo !== "boolean" || ![value.price_amount, value.buyer_fee_percent, value.buyer_fee_amount, value.total_amount]
          .every(item => typeof item === "string" && /^\d+\.\d{2}$/.test(item))) throw new ApiError(502, null);
    return value;
  },
};
