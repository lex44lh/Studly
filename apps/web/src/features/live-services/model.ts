import type { OwnService, ServiceDraftInput } from "@/lib/api/services";

export type EditableExtra = { id: string; title: string; price: string; days: string };
export type ServiceForm = { title: string; category: string; description: string; included: string; price: string; days: string; extras: EditableExtra[]; exampleIds: string[] };
export function serviceForm(service?: OwnService): ServiceForm {
  return { title: service?.title ?? "", category: service?.category ?? "", description: service?.description ?? "",
    included: service?.included.join("\n") ?? "", price: service?.price_amount ?? "0.00", days: String(service?.duration_days ?? 1),
    extras: service?.extras.map(extra => ({ id: extra.id, title: extra.title, price: extra.price_amount, days: String(extra.extra_days) })) ?? [],
    exampleIds: service ? [...service.portfolio_example_ids] : [] };
}
function price(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(normalized)) throw new Error("Цена должна быть от 0 до 99999999,99 ₽ с точностью до копейки.");
  const [whole, fraction = ""] = normalized.split(".");
  return `${Number(whole)}.${fraction.padEnd(2, "0")}`;
}
function days(value: string, min: number, max: number) {
  if (!/^\d+$/.test(value) || Number(value) < min || Number(value) > max) throw new Error(`Укажите целое число дней от ${min} до ${max}.`);
  return Number(value);
}
// A draft may be incomplete. Only Django decides readiness and publication.
export function draftFields(form: ServiceForm): Omit<ServiceDraftInput, "request_key" | "revision"> {
  const included = form.included.split("\n").map(line => line.trim()).filter(Boolean);
  if (included.length > 50 || included.some(line => line.length > 500)) throw new Error("В составе услуги допускается до 50 пунктов по 500 символов.");
  if (form.extras.length > 50 || form.exampleIds.length > 100) throw new Error("Допускается до 50 дополнений и 100 примеров работ.");
  return { title: form.title.trim(), category: form.category.trim(), description: form.description.trim(), included,
    price_amount: price(form.price), duration_days: days(form.days, 1, 32767), portfolio_example_ids: [...form.exampleIds],
    extras: form.extras.map(extra => {
      if (!extra.title.trim()) throw new Error("Укажите название каждого дополнения.");
      return { id: extra.id, title: extra.title.trim(), price_amount: price(extra.price), extra_days: days(extra.days, 0, 32766) };
    }) };
}
export const serviceStatus: Record<OwnService["status"], string> = {
  draft: "Черновик", pending: "На модерации", published: "Опубликована", rejected: "Отклонена", changes: "Требуются изменения",
};
