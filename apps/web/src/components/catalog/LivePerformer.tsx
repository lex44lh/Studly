"use client";
import { useCallback, useState } from "react";
import BackButton from "@/components/BackButton";
import { catalogClient } from "@/lib/api/catalog";
import { ApiState, useApiResource } from "./ApiState";
import ServiceList from "./ServiceList";

export default function LivePerformer({ id }: { id: string }) {
  const load = useCallback((signal: AbortSignal) => catalogClient.performer(id, signal), [id]);
  const { data: profile, error, retry } = useApiResource(id, load);
  const [pagination, setPagination] = useState({ id, query: "" });
  const page = pagination.id === id ? pagination.query : "";
  if (!profile) return <div className="campus-page"><BackButton /><div className="page-resource"><ApiState error={error} retry={retry} /></div></div>;
  const initials = profile.name.trim().split(/\s+/).slice(0,2).map(word => word[0]).join("");
  return <div className="campus-page"><BackButton /><div className="performer-layout">
    <section className="page-panel performer-summary"><div className="performer-initials" aria-hidden="true">{initials || "ST"}</div><p className="page-eyebrow">ИСПОЛНИТЕЛЬ</p><h1>{profile.name || "Профиль исполнителя"}</h1></section>
    <div><section className="page-panel"><h2>О себе</h2><p className="page-muted">{profile.about || "Описание пока не добавлено."}</p><p className="page-muted">Рейтинг и отзывы пока недоступны в Live.</p></section><section className="page-section"><div className="page-section-title"><h2>Активные услуги</h2></div><ServiceList key={id} query={page || `performer=${encodeURIComponent(id)}`} onPage={query => setPagination({ id, query })} /></section></div>
  </div></div>;
}
