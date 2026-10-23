"use client";

import { useCallback } from "react";
import { catalogClient, money } from "@/lib/api/catalog";
import { ApiState, useApiResource } from "./ApiState";
import { ServiceDetail, DetailState } from "./ServiceDetail";

function ServiceQuote({ id }: { id: string }) {
  const load = useCallback((signal: AbortSignal) => catalogClient.quote(id, signal), [id]);
  const { data, error, retry } = useApiResource(id, load);
  if (!data) return <ApiState error={error} retry={retry} />;
  return <div className="sd-quote">
    {data.is_demo && <p className="sd-quote-caption" role="note">Расчёт для демонстрационной услуги</p>}
    <div className="sd-quote-row"><span>Стоимость услуги</span><strong>{money(data.price_amount, data.currency)}</strong></div>
    <div className="sd-quote-row"><span>Комиссия STUDLY {data.buyer_fee_percent}%</span><strong>{money(data.buyer_fee_amount, data.currency)}</strong></div>
    <div className="sd-quote-row sd-quote-total"><span>Итого</span><strong>{money(data.total_amount, data.currency)}</strong></div>
    <button type="button" disabled>Оформление заказа пока недоступно</button>
  </div>;
}

export default function LiveService({ id }: { id: string }) {
  const load = useCallback((signal: AbortSignal) => catalogClient.service(id, signal), [id]);
  const { data: service, error, retry } = useApiResource(id, load);
  if (!service) return <DetailState><ApiState error={error} retry={retry} /></DetailState>;
  return <ServiceDetail isDemoMode={false} service={{
    id: service.id, title: service.title, description: service.description,
    price: money(service.price_amount, service.currency), duration: `${service.duration_days} дн.`,
    seller: service.performer.name, profileId: service.performer.id,
    included: service.included, isDemo: service.is_demo,
  }} chat={<button type="button" disabled>Чат пока недоступен</button>} order={<ServiceQuote id={id} />} />;
}
