"use client";
import { useCallback } from "react";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import ServiceFavoriteButton from "@/components/ServiceFavoriteButton";
import { catalogClient, money } from "@/lib/api/catalog";
import { ApiState, useApiResource } from "./ApiState";
function ServiceQuote({ id }: { id: string }) {
  const load = useCallback((signal: AbortSignal) => catalogClient.quote(id, signal), [id]);
  const { data, error, retry } = useApiResource(id, load);
  if (!data) return <ApiState error={error} retry={retry} />;
  return <div><p>Стоимость услуги: {money(data.price_amount, data.currency)}</p>
    <p>Комиссия STUDLY {data.buyer_fee_percent}%: {money(data.buyer_fee_amount, data.currency)}</p>
    <p><strong>Итого: {money(data.total_amount, data.currency)}</strong></p>
    <button type="button" disabled>Оформление заказа пока недоступно</button>
  </div>;
}
export default function LiveService({ id }: { id: string }) {
  const load = useCallback((signal: AbortSignal) => catalogClient.service(id, signal), [id]);
  const { data: service, error, retry } = useApiResource(id, load);
  if (!service) return <div><BackButton /><ApiState error={error} retry={retry} /></div>;
  return <div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
      <BackButton /><ServiceFavoriteButton serviceId={service.id} />
    </div>
    <div style={{ height: 220, background: "#F3F4F6", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>Фото услуги пока нет</div>
    {service.is_demo && <p role="note">Демонстрационная услуга</p>}
    <p style={{ color: "#3547B8", fontWeight: 700, fontSize: 24, marginBottom: 0 }}>{money(service.price_amount, service.currency)}</p>
    <h1 style={{ marginTop: 0, marginBottom: 40 }}>{service.title}</h1>
    <Link href={`/profile/${service.performer.id}`} style={{ textDecoration: "none", color: "inherit", fontWeight: 600 }}>{service.performer.name}</Link>
    <p>⏱ Срок выполнения: {service.duration_days} дн.</p>
    <button type="button" disabled>Чат пока недоступен</button>
    <h3>Описание:</h3><p>{service.description}</p><h3>Что входит:</h3>
    <ul>{service.included.map((item, index) => <li key={index}>{item}</li>)}</ul>
    <p>Дополнительные услуги пока недоступны.</p>
    <ServiceQuote id={id} />
  </div>;
}
