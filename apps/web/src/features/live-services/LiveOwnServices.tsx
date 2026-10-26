"use client";
import { useState } from "react";
import Link from "next/link";
import { servicesClient } from "@/lib/api/services";
import { money } from "@/lib/api/catalog";
import { pagePath } from "@/lib/api/client";
import { LiveAccess, LiveState, useLiveResource } from "@/features/live/shared";
import { serviceStatus } from "./model";

function OwnServicesContent() {
  const [query, setQuery] = useState("");
  const resource = useLiveResource(`own-services:${query}`, signal => servicesClient.myList(query, signal));
  return <section className="page-panel" aria-labelledby="live-own-services-title"><h2 id="live-own-services-title">Мои услуги</h2>
    <p className="page-muted">Серверные черновики и все редакции Ваших услуг. Изменения и решения сохраняются в аккаунте.</p>
    <div className="page-pagination"><Link className="page-button" href="/create-service">Создать черновик</Link><button type="button" className="secondary-btn" onClick={resource.reload}>Обновить услуги</button></div>
    {!resource.data ? <LiveState error={resource.error} loading={resource.loading} retry={resource.reload} /> : <>
      <p className="page-muted" role="status">Всего: {resource.data.count}</p>
      {!resource.data.results.length && <p>Пока нет сохранённых услуг.</p>}
      {resource.data.results.map(service => <article key={service.id} className="page-panel"><h3><Link href={`/create-service?id=${service.id}`}>{service.title || `Черновик №${service.id}`}</Link></h3>
        <p>{serviceStatus[service.status]} · версия {service.revision}</p><p className="page-muted">{money(service.price_amount, service.currency)} · {service.duration_days} дн.</p>
        {service.reason && <p>Причина решения: {service.reason}</p>}
        <Link href={`/create-service?id=${service.id}`}>Открыть редактор</Link>{service.status === "published" && <> · <Link href={`/service/${service.id}`}>Посмотреть в каталоге</Link></>}
      </article>)}
      <nav className="page-pagination" aria-label="Страницы моих услуг">{resource.data.previous && <button type="button" onClick={() => setQuery(pagePath(resource.data!.previous!, "my/services/", 2).split("?")[1] ?? "")}>Назад</button>}
        {resource.data.next && <button type="button" onClick={() => setQuery(pagePath(resource.data!.next!, "my/services/", 2).split("?")[1] ?? "")}>Далее</button>}</nav>
    </>}
  </section>;
}
export default function LiveOwnServices() { return <LiveAccess><OwnServicesContent /></LiveAccess>; }
