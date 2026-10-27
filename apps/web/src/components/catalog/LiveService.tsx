"use client";

import { useCallback, useState } from "react";
import { money } from "@/lib/api/catalog";
import { servicesClient, type ServiceV2 } from "@/lib/api/services";
import { useAuth } from "@/context/AuthContext";
import { LiveState, useLiveResource } from "@/features/live/shared";
import { LiveDiscussion, LiveQuote } from "@/features/live-commerce";
import LiveFavoriteFeedback from "@/features/live-services/LiveFavoriteFeedback";
import { ServiceDetail, DetailState } from "./ServiceDetail";
import styles from "@/features/live-commerce/commerce.module.css";

export default function LiveService({ id }: { id: string }) {
  const load = useCallback((signal: AbortSignal) => servicesClient.detail(id, signal), [id]);
  const { data: service, error, loading, reload } = useLiveResource(`service-v2:${id}`, load);
  if (!service) return <DetailState><LiveState error={error} loading={loading} retry={reload} /></DetailState>;
  return <ServiceContent key={`${service.id}:${service.revision}`} service={service} />;
}
function ServiceContent({ service }: { service: ServiceV2 }) {
  const { state } = useAuth();
  const [selected, setSelected] = useState<string[]>([]);
  const [locked, setLocked] = useState(false);
  const own = state.status === "authenticated" && state.user?.id === service.performer.id;
  const unavailable = service.is_demo ? "Обсуждение и оформление демонстрационной услуги через Live недоступны." : own ? "Нельзя заказать или открыть обсуждение собственной услуги." : "";
  const id = String(service.id);
  return <ServiceDetail isDemoMode={false} service={{
    id: service.id, title: service.title, description: service.description,
    price: money(service.price_amount, service.currency), duration: `${service.duration_days} дн.`,
    seller: service.performer.name, profileId: service.performer.id,
    included: service.included, isDemo: service.is_demo, category: service.category,
  }} extras={<div className={styles.extras}>{service.extras.length ? service.extras.map(extra => <label className={styles.check} key={extra.id}><input type="checkbox" checked={selected.includes(extra.id)} disabled={locked || !!unavailable} onChange={event => setSelected(previous => event.target.checked ? [...previous, extra.id] : previous.filter(value => value !== extra.id))} /><span>{extra.title} · {money(extra.price_amount, service.currency)} · +{extra.extra_days} дн.</span></label>) : <p className="sd-muted">Дополнений нет.</p>}{locked && <p className="sd-muted">Сначала уточните результат создания заказа с прежними условиями.</p>}</div>}
    chat={<><LiveFavoriteFeedback />{unavailable ? <p className="sd-muted">{unavailable}</p> : <LiveDiscussion serviceId={id} />}</>}
    order={unavailable ? <p className="sd-muted">{unavailable}</p> : <LiveQuote serviceId={id} serviceRevision={service.revision} performerId={service.performer.id} extras={service.extras.filter(extra => selected.includes(extra.id))} onRestoreExtras={setSelected} onLockChange={setLocked} />} />;
}
