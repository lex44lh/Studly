"use client";
import { useCallback } from "react";
import ServiceCard from "@/components/ServiceCard";
import { catalogClient, money } from "@/lib/api/catalog";
import { ApiState, useApiResource } from "./ApiState";
import { pagePath } from "@/lib/api/client";
export default function ServiceList({ query = "", limit, onPage }: { query?: string; limit?: number; onPage?: (query: string) => void }) {
  const load = useCallback((signal: AbortSignal) => catalogClient.list(query, signal), [query]);
  const { data, error, retry } = useApiResource(query, load);
  if (!data) return <ApiState error={error} retry={retry} />;
  return <>
    {!limit && <p role="status">Найдено: {data.count}</p>}
    {!data.results.length && <p>Ничего не найдено.</p>}
    {data.results.slice(0, limit).map(service => <ServiceCard key={service.id} id={service.id} title={service.title}
      price={money(service.price_amount, service.currency)} seller={service.performer.name} isDemo={service.is_demo} />)}
    {onPage && <nav aria-label="Страницы каталога">
      {data.previous && <button type="button" onClick={() => onPage(pagePath(data.previous!, "services/").split("?")[1] ?? "")}>Назад</button>}
      {data.next && <button type="button" onClick={() => onPage(pagePath(data.next!, "services/").split("?")[1] ?? "")}>Далее</button>}
    </nav>}
  </>;
}
