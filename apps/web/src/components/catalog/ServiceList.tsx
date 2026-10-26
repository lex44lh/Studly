"use client";
import { useCallback } from "react";
import ServiceCard from "@/components/ServiceCard";
import { money } from "@/lib/api/catalog";
import { servicesClient } from "@/lib/api/services";
import LiveFavoriteFeedback from "@/features/live-services/LiveFavoriteFeedback";
import { ApiState, useApiResource } from "./ApiState";
import { pagePath } from "@/lib/api/client";
import { Icon } from "@/components/studly/Icon";

export default function ServiceList({ query = "", limit, onPage }: { query?: string; limit?: number; onPage?: (query: string) => void }) {
  const load = useCallback((signal: AbortSignal) => servicesClient.list(query, signal), [query]);
  const { data, error, retry } = useApiResource(query, load);
  if (!data) return <div className="page-resource"><ApiState error={error} retry={retry} /></div>;
  return <>
    <LiveFavoriteFeedback />
    {!limit && <p className="page-muted" role="status">Найдено: {data.count}</p>}
    {!data.results.length && <div className="page-panel page-empty"><Icon name="search" /><h2>Ничего не найдено</h2><p>Здесь появятся доступные услуги.</p></div>}
    <div className="page-grid">{data.results.slice(0, limit).map(service => <ServiceCard key={service.id} id={service.id} title={service.title}
      price={money(service.price_amount, service.currency)} seller={service.performer.name} isDemo={service.is_demo} category={service.category} profileId={service.performer.id} duration={`${service.duration_days} дн.`} description={service.description} />)}</div>
    {onPage && <nav className="page-pagination" aria-label="Страницы каталога">
      {data.previous && <button type="button" onClick={() => onPage(pagePath(data.previous!, "services/", 2).split("?")[1] ?? "")}>Назад</button>}
      {data.next && <button type="button" onClick={() => onPage(pagePath(data.next!, "services/", 2).split("?")[1] ?? "")}>Далее</button>}
    </nav>}
  </>;
}
